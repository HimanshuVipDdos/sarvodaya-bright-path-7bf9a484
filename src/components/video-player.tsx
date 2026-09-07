import { useState, useRef, useEffect, type RefObject } from "react";
import ReactPlayer from "react-player";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { cn, getStorageUrl } from "@/lib/utils";

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  let target = url.trim();
  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1];
  }
  const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/i;
  const match = target.match(regExp);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }
  return null;
}

export function getEmbedableSource(url: string): { type: "youtube" | "drive" | "video"; embedUrl: string; rawUrl: string } | null {
  if (!url || !url.trim()) return null;
  let target = url.trim();

  // Extract src if iframe string
  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1];
  }

  // Google Drive
  const driveMatch = target.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/i);
  if (driveMatch && driveMatch[1]) {
    return {
      type: "drive",
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      rawUrl: target,
    };
  }

  // YouTube
  const ytId = extractYouTubeId(target);
  if (ytId) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`,
      rawUrl: `https://www.youtube.com/watch?v=${ytId}`,
    };
  }

  if (target.includes("youtube.com") || target.includes("youtu.be")) {
    return {
      type: "youtube",
      embedUrl: target.includes("?") ? `${target}&autoplay=1` : `${target}?autoplay=1`,
      rawUrl: target,
    };
  }

  // Direct video file
  const resolved = getStorageUrl(target) || target;
  return {
    type: "video",
    embedUrl: resolved,
    rawUrl: resolved,
  };
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const info = getEmbedableSource(url);
  return info?.type === "youtube" ? info.embedUrl : null;
}

type Props = {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
  fullscreenTargetRef?: RefObject<HTMLElement | null>;
  chatComponent?: React.ReactNode;
  isLive?: boolean;
  chatVisible?: boolean;
  onChatToggle?: () => void;
};

export function VideoPlayer({
  src,
  poster,
  title,
  className,
  chatComponent,
  isLive = false,
  chatVisible: externalChatVisible,
  onChatToggle: externalOnChatToggle,
}: Props) {
  const outerWrapRef = useRef<HTMLDivElement>(null);
  const [internalChatVisible, setInternalChatVisible] = useState(true);
  const chatVisible = externalChatVisible !== undefined ? externalChatVisible : internalChatVisible;

  const canShowChat = Boolean(isLive && (chatComponent || externalOnChatToggle));

  // ReactPlayer (cookpete/react-player) drives YouTube + direct file playback.
  // If it ever throws (blocked SDK, ad-blocker, flaky network, unsupported
  // embed), we drop to a raw iframe/<video> fallback so the class ALWAYS
  // plays — never a dead player for the student.
  const [playbackFailed, setPlaybackFailed] = useState(false);
  useEffect(() => {
    setPlaybackFailed(false);
  }, [src]);

  if (!src?.trim()) {
    return <VideoUnavailable message="No video link has been added for this class yet." className={className} />;
  }

  const embedInfo = getEmbedableSource(src);

  if (!embedInfo) {
    return <VideoUnavailable message="Invalid video URL format." className={className} />;
  }

  return (
    <div
      ref={outerWrapRef}
      className={cn(
        "group relative flex bg-black overflow-hidden transition-all duration-300 w-full h-full rounded-2xl border border-slate-800 shadow-xl",
        className
      )}
    >
      <div className="flex-1 relative min-w-0 h-full w-full flex items-center justify-center bg-black overflow-hidden">
        {embedInfo.type === "drive" ? (
          <div className="relative w-full h-full">
            <iframe
              src={embedInfo.embedUrl}
              title={title || "Video Lecture"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0"
            />
            <a
              href={embedInfo.rawUrl}
              target="_blank"
              rel="noreferrer"
              title="Open video in new tab if playback is restricted"
              className="absolute top-2 right-2 z-30 flex items-center gap-1 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-black hover:text-white backdrop-blur transition shadow-md opacity-75 hover:opacity-100"
            >
              <ExternalLink className="h-3 w-3" /> Open Link
            </a>
          </div>
        ) : embedInfo.type === "youtube" && playbackFailed ? (
          // Guaranteed-play fallback: raw YouTube iframe embed, used only if
          // ReactPlayer itself errors out (e.g. blocked script, IFrame API
          // hiccup). The class keeps playing no matter what.
          <div className="relative w-full h-full">
            <iframe
              src={embedInfo.embedUrl}
              title={title || "Video Lecture"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0"
            />
            <a
              href={embedInfo.rawUrl}
              target="_blank"
              rel="noreferrer"
              title="Open video in new tab if playback is restricted"
              className="absolute top-2 right-2 z-30 flex items-center gap-1 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-black hover:text-white backdrop-blur transition shadow-md opacity-75 hover:opacity-100"
            >
              <ExternalLink className="h-3 w-3" /> Open Link
            </a>
          </div>
        ) : embedInfo.type === "youtube" ? (
          <div className="relative w-full h-full">
            <ReactPlayer
              key={embedInfo.rawUrl}
              src={embedInfo.rawUrl}
              playing
              controls
              playsInline
              width="100%"
              height="100%"
              style={{ position: "absolute", inset: 0 }}
              config={{
                youtube: {
                  rel: 0,
                  ...(typeof window !== "undefined" ? { origin: window.location.origin } : {}),
                },
              }}
              onError={() => setPlaybackFailed(true)}
            />
            <a
              href={embedInfo.rawUrl}
              target="_blank"
              rel="noreferrer"
              title="Open video in new tab if playback is restricted"
              className="absolute top-2 right-2 z-30 flex items-center gap-1 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-black hover:text-white backdrop-blur transition shadow-md opacity-75 hover:opacity-100"
            >
              <ExternalLink className="h-3 w-3" /> Open Link
            </a>
          </div>
        ) : playbackFailed ? (
          <video
            src={embedInfo.embedUrl}
            poster={poster}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <ReactPlayer
            key={embedInfo.embedUrl}
            src={embedInfo.embedUrl}
            playing
            controls
            playsInline
            width="100%"
            height="100%"
            style={{ backgroundColor: "black" }}
            onError={() => setPlaybackFailed(true)}
          />
        )}
      </div>

      {chatComponent && chatVisible && canShowChat && (
        <div className="w-[300px] sm:w-[350px] lg:w-[380px] shrink-0 border-l border-slate-200 h-full flex flex-col bg-white animate-in slide-in-from-right duration-200">
          {chatComponent}
        </div>
      )}
    </div>
  );
}

function VideoUnavailable({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900 p-6 text-center text-sm text-slate-300 border border-slate-800", className)}>
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <p>{message}</p>
    </div>
  );
}