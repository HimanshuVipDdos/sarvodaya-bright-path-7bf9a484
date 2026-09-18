import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Clipboard, Play, Video, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractYouTubeId } from "@/components/video-player";
import { isGoogleDriveLink } from "@/lib/document-utils";

interface VideoLinkInputWithPreviewProps {
  value: string;
  onChange: (url: string, autoThumbnailUrl?: string) => void;
  label?: string;
  placeholder?: string;
  helper?: string;
  required?: boolean;
}

export function VideoLinkInputWithPreview({
  value,
  onChange,
  label = "Video / Live Class Link",
  placeholder = "YouTube link yahan paste karein (e.g. https://youtu.be/... ya https://youtube.com/live/...)",
  helper,
  required = false,
}: VideoLinkInputWithPreviewProps) {
  const [testPlaying, setTestPlaying] = useState(false);

  const youtubeId = useMemo(() => extractYouTubeId(value), [value]);
  const isDrive = useMemo(() => isGoogleDriveLink(value), [value]);

  const autoThumb = useMemo(() => {
    if (youtubeId) {
      return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }
    return null;
  }, [youtubeId]);

  // When a valid YouTube ID is detected, notify parent with the auto thumbnail URL
  useEffect(() => {
    if (autoThumb) {
      onChange(value, autoThumb);
    }
  }, [youtubeId, autoThumb]);

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text?.trim()) {
          const trimmed = text.trim();
          const ytId = extractYouTubeId(trimmed);
          const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined;
          onChange(trimmed, thumb);
          toast.success("Link pasted successfully!");
        } else {
          toast.info("Clipboard is empty. Please copy your video link first.");
        }
      } else {
        toast.info("Please use Ctrl+V or right-click to paste.");
      }
    } catch {
      toast.info("Please use Ctrl+V or right-click to paste.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-primary" />
          <span>{label}</span>
          {required && <span className="text-red-500">*</span>}
        </Label>
        <button
          type="button"
          onClick={handlePaste}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition cursor-pointer bg-primary/10 hover:bg-primary/15 px-2 py-0.5 rounded-md"
        >
          <Clipboard className="h-3 w-3" />
          <span>Paste Link (पेस्ट करें)</span>
        </button>
      </div>

      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            const ytId = extractYouTubeId(val);
            const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined;
            onChange(val, thumb);
            setTestPlaying(false);
          }}
          placeholder={placeholder}
          className="pr-10 font-mono text-xs"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("", undefined);
              setTestPlaying(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
            title="Clear link"
          >
            ✕
          </button>
        )}
      </div>

      {/* Helpful instruction for teachers */}
      <p className="text-[11px] text-muted-foreground">
        {helper || "💡 Teacher Tip: YouTube App ya Browser se koi bhi link (Watch, Live, ya Share) copy karke yahan paste karein. Thumbnail apne aap lag jayega."}
      </p>

      {/* Instant Validation & Preview Box */}
      {youtubeId ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Valid YouTube Video Detected! (पहचान लिया गया)</span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30 font-mono">
              ID: {youtubeId}
            </Badge>
          </div>

          <div className="relative rounded-lg overflow-hidden border border-emerald-500/20 bg-black aspect-video max-w-sm">
            {testPlaying ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                title="Lecture Preview"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="relative w-full h-full group">
                <img
                  src={autoThumb || ""}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-3 text-center transition group-hover:bg-black/50">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setTestPlaying(true)}
                    className="gap-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg text-xs font-bold px-4 py-1.5 h-auto"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Test Play (चलाकर देखें)</span>
                  </Button>
                  <span className="mt-2 text-[10px] text-white/90 font-medium">
                    Auto-thumbnail ready ✓
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : isDrive ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Valid Google Drive Document / Video Link Detected!</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            This document or video will open smoothly for students in the class player.
          </p>
        </div>
      ) : value.trim() ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800 dark:text-amber-300">
            <span className="font-bold">Check link: </span>
            Aapne jo link daala hai wo YouTube ya Google Drive link jaisa nahi lag raha. Kripya check karein ki pura link copy hua hai.
          </div>
        </div>
      ) : null}
    </div>
  );
}
