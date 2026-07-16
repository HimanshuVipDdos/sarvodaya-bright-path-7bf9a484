import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  title?: string;
  poster?: string;
  liveClassId: string;
  className?: string;
};

/**
 * A live class = video + live comments, wired together so fullscreen
 * behaves like the YouTube app: outside fullscreen the chat sits beside the
 * video at all times; entering fullscreen hides it behind a small corner
 * toggle, and opening it slides a chat panel in over the video (without
 * leaving fullscreen or changing the video's resolution/state).
 */
export function LiveClassPlayer({ src, title, poster, liveClassId, className }: Props) {
  const fsRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      const fs = document.fullscreenElement === fsRef.current;
      setIsFullscreen(fs);
      if (!fs) setChatOpen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div
      ref={fsRef}
      className={cn(
        isFullscreen ? "h-full w-full bg-black" : "flex flex-col gap-3 lg:flex-row",
        className,
      )}
    >
      <div className={cn("relative", isFullscreen ? "h-full w-full" : "min-w-0 lg:flex-1")}>
        <VideoPlayer
          src={src}
          title={title}
          poster={poster}
          fullscreenTargetRef={fsRef}
          className={isFullscreen ? "h-full w-full rounded-none" : undefined}
        />

        {isFullscreen && !chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Open live chat"
            className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
          >
            <MessageCircle className="h-4 w-4" /> Chat
          </button>
        )}

        {isFullscreen && chatOpen && (
          <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-xs flex-col bg-black/90 backdrop-blur-md sm:max-w-sm">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Live Chat</span>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <LiveChat liveClassId={liveClassId} className="h-full" />
            </div>                                                                                                                                                                                                                                                                                                                                                                                                              
         {!isFullscreen && (
        <div className="w-full min-w-0 lg:w-80 lg:shrink-0">
          <LiveChat liveClassId={liveClassId} className="h-64 sm:h-72 lg:h-[26rem]" />
        </div>
      )}
          </div>
        )}
      </div>                                                                                                                                                                                                                                                                                     
    </div>
  );
}
