import { useState } from "react";
import { FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function toEmbeddableUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // Google Drive share link -> inline preview embed
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }

    // Direct PDF (or unknown file type) -> Google Docs viewer renders it
    if (/\.pdf(\?|#|$)/i.test(u.pathname) || !/\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(u.pathname)) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }
  } catch {}
  return url;
}

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
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;

  const handleOpenChange = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    if (!val) onClose?.();
  };

  if (!url && !trigger && !isOpen) return null;

  const embedUrl = url ? toEmbeddableUrl(url) : "";

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
        <DialogContent className="flex h-[90vh] max-w-4xl flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 flex-row items-center justify-between border-b px-4 py-3 space-y-0">
            <DialogTitle className="truncate text-sm font-bold">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted">
            {embedUrl && (
              <iframe src={embedUrl} title={title} className="h-full w-full border-0" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
