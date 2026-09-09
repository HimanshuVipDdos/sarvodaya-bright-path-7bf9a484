export interface ResolvedStream {
  streamUrl: string;
  type: "hls" | "mp4";
  title?: string;
}

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.privacy.com.de",
  "https://piped-api.garudalinux.org",
  "https://pipedapi.tokhmi.xyz",
  "https://api-piped.mha.fi",
];

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.projectsegfau.lt",
  "https://iv.ggtyler.dev",
  "https://vid.puffyan.us",
];

// In-memory cache to avoid repeated fetch calls for recently resolved video IDs
const streamCache = new Map<string, { result: ResolvedStream; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchFromPiped(instance: string, videoId: string, signal: AbortSignal): Promise<ResolvedStream> {
  const res = await fetch(`${instance}/streams/${videoId}`, { signal });
  if (!res.ok) throw new Error(`Piped ${instance} responded with ${res.status}`);
  const data = await res.json();

  if (data.hls && typeof data.hls === "string") {
    return { streamUrl: data.hls, type: "hls", title: data.title };
  }

  const directMp4 = data.videoStreams?.find(
    (s: any) => !s.videoOnly && (s.mimeType?.includes("mp4") || s.format?.toLowerCase() === "mp4")
  );
  if (directMp4?.url) {
    return { streamUrl: directMp4.url, type: "mp4", title: data.title };
  }

  throw new Error(`No compatible stream in Piped (${instance})`);
}

async function fetchFromInvidious(instance: string, videoId: string, signal: AbortSignal): Promise<ResolvedStream> {
  const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal });
  if (!res.ok) throw new Error(`Invidious ${instance} responded with ${res.status}`);
  const data = await res.json();

  if (data.hlsUrl && typeof data.hlsUrl === "string") {
    return { streamUrl: data.hlsUrl, type: "hls", title: data.title };
  }

  const directMp4 = data.formatStreams?.find(
    (s: any) => (s.container === "mp4" || s.encoding?.toLowerCase() === "h264") && s.url
  );
  if (directMp4?.url) {
    return { streamUrl: directMp4.url, type: "mp4", title: data.title };
  }

  throw new Error(`No compatible stream in Invidious (${instance})`);
}

/**
 * Races multiple public Piped and Invidious instances to extract a direct HLS or MP4 stream.
 * Aborts and throws if no instance resolves within maxTimeoutMs (default: 2800ms).
 */
export async function resolveVideoStream(
  videoId: string,
  maxTimeoutMs = 2800
): Promise<ResolvedStream> {
  if (!videoId || videoId.length !== 11) {
    throw new Error("Invalid videoId provided to stream resolver");
  }

  // Check cache first
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), maxTimeoutMs);

  try {
    const candidatePromises = [
      fetchFromPiped(PIPED_INSTANCES[0], videoId, controller.signal),
      fetchFromPiped(PIPED_INSTANCES[1], videoId, controller.signal),
      fetchFromPiped(PIPED_INSTANCES[2], videoId, controller.signal),
      fetchFromInvidious(INVIDIOUS_INSTANCES[0], videoId, controller.signal),
      fetchFromInvidious(INVIDIOUS_INSTANCES[1], videoId, controller.signal),
      fetchFromInvidious(INVIDIOUS_INSTANCES[2], videoId, controller.signal),
    ];

    const result = await Promise.any(candidatePromises);
    clearTimeout(timeoutId);

    // Save to cache
    streamCache.set(videoId, { result, timestamp: Date.now() });
    return result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(
      `Stream resolution timed out or failed for videoId ${videoId}: ${err?.message || err}`
    );
  }
}
