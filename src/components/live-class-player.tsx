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
  /** Chat only ever makes sense for a class that is actually live right now
   *  — a recorded/VOD lecture has no one to chat with. Defaults to true for
   *  back-compat, but callers playing back a recording should pass false. */
  isLive?: boolean;
  className?: string;
};

/**
 * A live class = video + live comments. The chat option lives in the video
 * overlay: a small "Chat" toggle in the corner. Clicking it slides a chat
 * panel in from the right and the video RESIZES (shrinks) to make room for
 * it — the video is never covered or cropped, on-screen or in fullscreen.
 * Recorded/VOD playback never shows the chat option at all.
 */
export function LiveClassPlayer({ src, title, poster, liveClassId, isLive = true, className }: Props) {
  const fsRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(isLive);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === fsRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const showChat = isLive && chatOpen;

  return (
    <div
      ref={fsRef}
      className={cn(
        isFullscreen ? "h-full w-full overflow-hidden bg-black" : "",
        "flex flex-col gap-3 lg:flex-row",
        className,
      )}
    >
      {/* Video shrinks to make room for chat instead of being overlaid/cropped */}
      <div className={cn("relative min-w-0", isFullscreen ? "h-full flex-1" : "flex-1")}>
        <VideoPlayer
          src={src}
          title={title}
          poster={poster}
          fullscreenTargetRef={fsRef}
          className={isFullscreen ? "h-full w-full rounded-none" : undefined}
        />

        {isLive && !chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Open live chat"
            className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-2 text-xs font-medium text-white transition hover:bg-black"
          >
            <MessageCircle className="h-4 w-4" /> Chat
          </button>
        )}
      </div>

      {/* Chat panel: fixed width, sits beside the (now-smaller) video, never on top of it */}
      {showChat && (
        <div
          className={cn(
            "flex min-w-0 shrink-0 flex-col",
            isFullscreen
              ? "h-full w-full max-w-xs bg-black sm:max-w-sm"
              : "w-full lg:w-80",
          )}
        >
          {isFullscreen && (
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
          )}
          <LiveChat
            liveClassId={liveClassId}
            className={isFullscreen ? "h-full flex-1" : "h-64 sm:h-72 lg:h-[26rem]"}
          />
        </div>
      )}
    </div>
  );
}
