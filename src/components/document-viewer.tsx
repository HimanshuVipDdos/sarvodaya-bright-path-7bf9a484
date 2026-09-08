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
  } catch {}
  return url;
}

type Props = {
  url: string;
  title: string;
  trigger?: React.ReactNode;
};

/** Opens a document (PDF / Drive / DPP / notes) inside the site's own UI
 *  instead of navigating away to a new tab. */
export function DocumentViewer({ url, title, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const embedUrl = toEmbeddableUrl(url);

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents cursor-pointer">
        {trigger ?? (
          <Button size="sm" variant="secondary" className="gap-1">
            <FileText className="h-3.5 w-3.5" /> Open
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90vh] max-w-4xl flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 flex-row items-center justify-between border-b px-4 py-3 space-y-0">
            <DialogTitle className="truncate text-sm">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted">
            <object data={embedUrl} type="application/pdf" className="h-full w-full">
              <iframe src={embedUrl} title={title} className="h-full w-full border-0" />
            </object>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
