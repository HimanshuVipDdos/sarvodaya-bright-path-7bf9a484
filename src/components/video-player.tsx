import { useState, useRef, useEffect, type RefObject } from "react";
import { motion } from "framer-motion";
import ReactPlayer from "react-player";
import { AlertTriangle } from "lucide-react";
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
  if (target.includes("youtube.com") || target.includes("youtu.be")) {
    const ytId = extractYouTubeId(target);
    if (ytId) {
      return {
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&playsinline=1`,
        rawUrl: `https://www.youtube.com/watch?v=${ytId}`,
      };
    } else {
      // It's a YouTube link but no 11-char ID found (maybe a playlist or custom URL)
      // Attempt to convert to an embed URL anyway to avoid native video tag failure
      try {
        const u = new URL(target);
        if (u.pathname === "/watch") {
          const v = u.searchParams.get("v");
          if (v) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${v}?autoplay=1`, rawUrl: target };
        } else if (u.pathname === "/playlist") {
          const list = u.searchParams.get("list");
          if (list) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/videoseries?list=${list}`, rawUrl: target };
        }
      } catch {}
      // Absolute fallback: still treat as youtube so we use iframe instead of ReactPlayer/native-video
      return {
        type: "youtube",
        embedUrl: target.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/"),
        rawUrl: target,
      };
    }
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

  // Direct video files go through ReactPlayer (cookpete/react-player), with a
  // plain <video> tag as a safety-net fallback if it ever errors.
  //
  // YouTube deliberately does NOT go through ReactPlayer's YouTube provider
  // (a custom media-element under the hood) — that provider surfaced its own
  // internal "media failed" placeholder for some perfectly valid links,
  // without ever calling our onError, so the guaranteed-play fallback never
  // kicked in and the class was just stuck. A plain YouTube iframe embed is
  // the proven-reliable path this app already used successfully before, so
  // YouTube always uses that directly — no custom element in the way that
  // can silently fail.
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
    <motion.div
      ref={outerWrapRef}
      // One-time fade-in on mount — a single cheap opacity transition, not a
      // continuous loop, so it adds a premium feel without costing anything
      // once it's finished.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "group relative flex bg-white overflow-hidden transition-all duration-300 w-full h-full rounded-2xl border border-slate-200 shadow-xl",
        className
      )}
    >
      <div className="flex-1 relative min-w-0 h-full w-full flex items-center justify-center bg-white overflow-hidden">
        {embedInfo.type === "drive" ? (
          <iframe
            src={embedInfo.embedUrl}
            title={title || "Video Lecture"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        ) : embedInfo.type === "youtube" ? (
          <iframe
            key={embedInfo.embedUrl}
            src={embedInfo.embedUrl}
            title={title || "Video Lecture"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        ) : playbackFailed ? (
          <video
            src={embedInfo.embedUrl}
            poster={poster}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-white"
          />
        ) : (
          <ReactPlayer
            key={embedInfo.embedUrl}
            url={embedInfo.embedUrl}
            playing
            controls
            playsInline
            width="100%"
            height="100%"
            style={{ backgroundColor: "white" }}
            onError={() => setPlaybackFailed(true)}
          />
        )}
      </div>

      {chatComponent && chatVisible && canShowChat && (
        <div className="w-[300px] sm:w-[350px] lg:w-[380px] shrink-0 border-l border-slate-200 h-full flex flex-col bg-white animate-in slide-in-from-right duration-200">
          {chatComponent}
        </div>
      )}
    </motion.div>
  );
}

function VideoUnavailable({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 border border-slate-200", className)}>
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p>{message}</p>
    </div>
  );
}
