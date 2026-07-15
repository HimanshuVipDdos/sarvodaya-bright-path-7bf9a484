import React, { useState, useRef, useCallback } from "react";
import ReactPlayer from "react-player/youtube";
import type { OnProgressProps } from "react-player/base";

interface VideoPlayerProps {
  /** YouTube video URL (watch, youtu.be, or embed link — sab chalega) */
  src: string;
  /** Thumbnail shown before play (react-player ka "light" mode ke liye) */
  poster?: string;
  title?: string;
  isLive?: boolean;
  /** Optional: 0 se 1 tak progress milega, apna DB update yahan karo */
  onProgress?: (playedFraction: number) => void;
  /** Optional: video complete hone par fire hoga (lecture "done" mark karne ke liye) */
  onEnded?: () => void;
}

export function VideoPlayer({
  src,
  poster,
  title,
  isLive = false,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<ReactPlayer>(null);

  const handleProgress = useCallback(
    (state: OnProgressProps) => {
      onProgress?.(state.played);
    },
    [onProgress]
  );

  const handleError = useCallback(() => {
    setError("Video load nahi ho paya. Link check karo ya thodi der baad try karo.");
  }, []);

  if (!src) {
    return (
      <div className="w-full aspect-video bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center text-gray-500">
        Video URL missing hai
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-800">
        {isLive && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}

        {error ? (
          <div className="w-full h-full flex items-center justify-center text-red-400 text-sm p-4 text-center">
            {error}
          </div>
        ) : (
          <ReactPlayer
            ref={playerRef}
            url={src}
            light={!playing ? poster ?? true : false}
            playing={playing}
            controls
            width="100%"
            height="100%"
            onClickPreview={() => setPlaying(true)}
            onReady={() => setReady(true)}
            onProgress={handleProgress}
            onEnded={onEnded}
            onError={handleError}
            progressInterval={5000}
            config={{
              playerVars: {
                modestbranding: 1,
                rel: 0,
                disablekb: 0,
                iv_load_policy: 3, // annotations off
              },
            }}
            style={{ position: "absolute", top: 0, left: 0 }}
          />
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none text-gray-400 text-sm">
            Loading player...
          </div>
        )}
      </div>

      {title && (
        <p className="mt-2 text-sm text-gray-400 truncate">{title}</p>
      )}
    </div>
  );
}
