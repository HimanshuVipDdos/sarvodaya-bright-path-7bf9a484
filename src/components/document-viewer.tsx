import { useState, useEffect } from "react";
import { FileText, Loader2, Sparkles, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toEmbeddableDocumentUrl, isGoogleDriveLink } from "@/lib/document-utils";

type Props = {
  url: string | null;
  title: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onClose?: () => void;
};

/** Opens a document (PDF / Drive / DPP / notes) inside the site's own UI
 *  instead of navigating away to a new tab. */
export function DocumentViewer({ url, title, trigger, open: externalOpen, onClose }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;

  const handleOpenChange = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    if (!val) {
      setLoading(true);
      onClose?.();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
    }
  }, [isOpen, url]);

  if (!url && !trigger && !isOpen) return null;

  const embedUrl = url ? toEmbeddableDocumentUrl(url) : "";
  const isDrive = isGoogleDriveLink(url);

  return (
    <>
      {trigger ? (
        <span onClick={() => handleOpenChange(true)} className="contents cursor-pointer">
          {trigger}
        </span>
      ) : !isControlled && url ? (
        <span onClick={() => handleOpenChange(true)} className="contents cursor-pointer">
          <Button size="sm" variant="secondary" className="gap-1">
            <FileText className="h-3.5 w-3.5" /> Open
          </Button>
        </span>
      ) : null}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="flex h-[92vh] max-w-5xl flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
          <DialogHeader className="flex-shrink-0 flex-row items-center justify-between border-b px-4 sm:px-6 py-3 space-y-0 bg-slate-900 text-white">
            <div className="flex items-center gap-2 min-w-0 pr-8">
              <div className="p-1 rounded bg-[#6043ED]/20 text-[#A290FB] shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <DialogTitle className="truncate text-sm font-bold text-white tracking-tight">
                {title}
              </DialogTitle>
            </div>
            {isDrive && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3 text-emerald-400" />
                Google Drive PDF
              </span>
            )}
          </DialogHeader>

          <div className="flex-1 relative overflow-hidden bg-slate-100 flex flex-col">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 gap-2">
                <Loader2 className="h-8 w-8 text-[#6043ED] animate-spin" />
                <p className="text-xs font-semibold text-slate-600">Loading document preview…</p>
              </div>
            )}

            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={title}
                onLoad={() => setLoading(false)}
                className="h-full w-full border-0 bg-white"
                allow="autoplay"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500">
                <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
                <p className="text-sm font-bold text-slate-800">Invalid Document URL</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  The document link could not be loaded. Please check that the URL is valid.
                </p>
              </div>
            )}
          </div>

          <div className="px-4 py-2 bg-slate-50 border-t text-[11px] text-slate-500 flex items-center justify-between">
            <span>📖 In-App Web Document Viewer</span>
            {isDrive && (
              <span className="text-slate-400 hidden sm:inline">
                File must be shared as "Anyone with the link can view" in Google Drive.
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
