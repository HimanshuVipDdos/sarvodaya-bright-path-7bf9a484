import { defineEventHandler, getQuery, getHeader, setResponseHeader, setResponseStatus, createError } from 'h3';
import ytdl from '@distube/ytdl-core';

// In-memory cache for resolved direct stream URLs (15 min TTL)
const streamUrlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Multiple public API mirrors as backup resolvers
const PUBLIC_RESOLVERS = [
  'https://api.piped.privacy.com.de',
  'https://piped-api.garudalinux.org',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
];

async function resolveDirectStreamUrl(videoId: string): Promise<string | null> {
  // 1. Check cache first
  const cached = streamUrlCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.url;
  }

  // 2. Try @distube/ytdl-core with modern browser headers
  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, {
      requestOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    });

    // Pick progressive mp4 with both audio & video (itag 22 = 720p, itag 18 = 360p)
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: (f) => Boolean(f.hasAudio && f.hasVideo && (f.container === 'mp4' || f.mimeType?.includes('mp4'))),
    }) || ytdl.chooseFormat(info.formats, { filter: 'audioandvideo' });

    if (format?.url) {
      streamUrlCache.set(videoId, { url: format.url, timestamp: Date.now() });
      return format.url;
    }
  } catch (err: any) {
    console.warn(`[API /api/stream] ytdl-core resolution error for ${videoId}:`, err?.message || err);
  }

  // 3. Fallback: Race public instance mirrors with short timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  const mirrorPromises = PUBLIC_RESOLVERS.map(async (base) => {
    const isPiped = base.includes('piped');
    const endpoint = isPiped ? `${base}/streams/${videoId}` : `${base}/api/v1/videos/${videoId}`;
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'SarvodayaStreamProxy/1.0' },
    });
    if (!res.ok) throw new Error(`Mirror ${base} responded ${res.status}`);
    const data = await res.json();
    if (isPiped) {
      const mp4 = data.videoStreams?.find((s: any) => !s.videoOnly && (s.mimeType?.includes('mp4') || s.format === 'mp4'));
      if (mp4?.url) return mp4.url as string;
      if (data.hls && typeof data.hls === 'string') return data.hls as string;
    } else {
      const mp4 = data.formatStreams?.find((s: any) => s.container === 'mp4' && s.url);
      if (mp4?.url) return mp4.url as string;
      if (data.hlsUrl) return data.hlsUrl as string;
    }
    throw new Error(`No stream found on ${base}`);
  });

  try {
    const resolved = await Promise.any(mirrorPromises);
    clearTimeout(timer);
    if (resolved) {
      streamUrlCache.set(videoId, { url: resolved, timestamp: Date.now() });
      return resolved;
    }
  } catch {
    clearTimeout(timer);
  }

  return null;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawV = (query.v as string) || '';

  // Extract 11-char video ID if a full URL was passed
  let videoId = rawV.trim();
  if (videoId.includes('youtube.com/') || videoId.includes('youtu.be/')) {
    const match = videoId.match(/(?:v=|\/embed\/|\/watch\?v=|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) videoId = match[1];
  }

  if (!videoId || videoId.length !== 11) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'A valid 11-character YouTube video ID is required (?v=...).',
    });
  }

  // Resolve target stream URL
  const targetUrl = await resolveDirectStreamUrl(videoId);
  if (!targetUrl) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Stream Unavailable',
      message: 'Unable to extract direct stream for this video. Use fallback player.',
    });
  }

  // Handle HTTP Range header for seeking & buffering
  const rangeHeader = getHeader(event, 'range');
  const upstreamHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: '*/*',
    Connection: 'keep-alive',
  };

  if (rangeHeader) {
    upstreamHeaders['Range'] = rangeHeader;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw createError({
        statusCode: upstreamRes.status,
        statusMessage: 'Upstream CDN Error',
        message: `Upstream streaming server returned ${upstreamRes.status}`,
      });
    }

    // Set streaming headers
    const status = upstreamRes.status === 206 ? 206 : 200;
    setResponseStatus(event, status);

    setResponseHeader(event, 'Content-Type', upstreamRes.headers.get('content-type') || 'video/mp4');
    setResponseHeader(event, 'Accept-Ranges', 'bytes');
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) setResponseHeader(event, 'Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) setResponseHeader(event, 'Content-Range', contentRange);

    return upstreamRes.body;
  } catch (err: any) {
    console.error(`[API /api/stream] Error streaming chunk for ${videoId}:`, err?.message || err);
    throw createError({
      statusCode: 500,
      statusMessage: 'Streaming Error',
      message: err?.message || 'Failed to proxy video stream',
    });
  }
});
