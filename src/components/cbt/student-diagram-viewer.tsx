import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentDiagramViewerProps {
  src: string;
  alt?: string;
  className?: string;
  maxThumbnailHeight?: string;
}

export function StudentDiagramViewer({
  src,
  alt = "Question diagram",
  className,
  maxThumbnailHeight = "max-h-[300px]",
}: StudentDiagramViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);

  // Reset scale when modal closes
  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setHighContrast(false);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Question Card Thumbnail Display */}
      <div className={cn("my-2 inline-block max-w-full select-none", className)}>
        <div
          onClick={() => setIsOpen(true)}
          className="group relative cursor-zoom-in inline-block rounded-2xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/90 p-2 shadow-xs hover:shadow-md hover:border-indigo-400 transition-all duration-200"
          title="Click to Zoom Fullscreen"
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className={cn(
              "w-auto object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.01]",
              maxThumbnailHeight
            )}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Click to Zoom</span>
          </div>
        </div>
      </div>

      {/* Full-Screen Lightbox Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          {/* Top Controls Toolbar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-20">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                <Maximize2 className="w-4 h-4 text-indigo-400" /> Diagram Zoom
              </span>
              <button
                type="button"
                onClick={() => setHighContrast(!highContrast)}
                className={cn(
                  "px-3 py-1 text-xs rounded-xl border transition-all cursor-pointer font-bold",
                  highContrast
                    ? "bg-amber-400 border-amber-300 text-black shadow-xs"
                    : "border-white/20 text-white/90 hover:bg-white/10"
                )}
              >
                {highContrast ? "Contrast: HIGH" : "High Contrast"}
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 bg-zinc-900/95 border border-zinc-700/90 rounded-2xl px-2.5 py-1 shadow-lg">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                className="p-1.5 hover:text-indigo-400 transition cursor-pointer text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-1.5 text-zinc-300 min-w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3.5, s + 0.25))}
                className="p-1.5 hover:text-indigo-400 transition cursor-pointer text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setScale(1)}
                className="p-1.5 hover:text-indigo-400 transition cursor-pointer border-l border-zinc-700 pl-2 text-white"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:text-red-400 transition cursor-pointer border-l border-zinc-700 pl-2 text-white"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Zoomable Viewport */}
          <div
            className="w-full h-full flex items-center justify-center overflow-auto p-4 sm:p-12 cursor-grab active:cursor-grabbing"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div
              className={cn(
                "transition-transform duration-150 ease-out origin-center rounded-2xl p-3 shadow-2xl max-w-full max-h-full flex items-center justify-center",
                highContrast
                  ? "bg-white invert-[0.9] hue-rotate-180 border-2 border-amber-400"
                  : "bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
              )}
              style={{ transform: `scale(${scale})` }}
            >
              <img
                src={src}
                alt={alt}
                className="max-h-[80vh] max-w-[85vw] object-contain select-none"
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
