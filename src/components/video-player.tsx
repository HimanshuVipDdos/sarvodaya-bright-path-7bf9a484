import { useEffect, useRef, useState, type RefObject } from "react";
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

export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
  }
  return null;
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
  fullscreenTargetRef,
  chatComponent,
  isLive = false,
  chatVisible: externalChatVisible,
  onChatToggle: externalOnChatToggle,
}: Props) {
  const outerWrapRef = useRef<HTMLDivElement>(null);
  const [internalChatVisible, setInternalChatVisible] = useState(true);
  const chatVisible = externalChatVisible !== undefined ? externalChatVisible : internalChatVisible;

  const canShowChat = Boolean(isLive && (chatComponent || externalOnChatToggle));

  if (!src?.trim()) {
    return <VideoUnavailable message="No video link has been added for this class yet." className={className} />;
  }

  const youtubeEmbedUrl = getYouTubeEmbedUrl(src);
  const resolvedVideoSrc = getStorageUrl(src) || src;

  return (
    <div
      ref={outerWrapRef}
      className={cn(
        "group relative flex bg-black overflow-hidden transition-all duration-300 w-full h-full rounded-2xl border border-slate-800 shadow-xl",
        className
      )}
    >
      <div className="flex-1 relative min-w-0 h-full w-full flex items-center justify-center bg-black overflow-hidden">
        {youtubeEmbedUrl ? (
          <iframe
            src={youtubeEmbedUrl}
            title={title || "Video Lecture"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        ) : (
          <video
            src={resolvedVideoSrc}
            poster={poster}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
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