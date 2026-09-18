import { createFileRoute } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";
import { DocumentViewer } from "@/components/document-viewer";
import { Button } from "@/components/ui/button";
import { MaterialNavSwitcher } from "@/components/admin/material-nav-switcher";

type Material = {
  id: string;
  title: string;
  subject: string | null;
  chapter: string | null;
  is_free: boolean;
  file_url: string | null;
  batch_id: string | null;
};

const columns: Column<Material>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-semibold text-foreground">{r.title}</span> },
  { key: "batch_id", label: "Batch" },
  {
    key: "subject",
    label: "Subject",
    render: (r) =>
      r.subject ? (
        <span className="inline-flex items-center gap-1 font-medium text-xs px-2 py-0.5 rounded-md bg-muted">
          📁 {r.subject}
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "chapter",
    label: "Chapter",
    render: (r) =>
      r.chapter ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          📖 {r.chapter}
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "is_free",
    label: "Access",
    render: (r) =>
      r.is_free ? (
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          Free
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Batch Only</span>
      ),
  },
  {
    key: "file_url",
    label: "DPP Sheet",
    render: (r) =>
      r.file_url ? (
        <DocumentViewer
          url={r.file_url}
          title={r.title}
          trigger={
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-lg text-amber-600 border-amber-300 hover:bg-amber-50 text-xs font-semibold dark:border-amber-700 dark:hover:bg-amber-950/40"
            >
              <Eye className="h-3.5 w-3.5" /> View in App
            </Button>
          }
        />
      ) : (
        <span className="text-muted-foreground text-xs italic">No File</span>
      ),
  },
];

const fields: Field[] = [
  {
    name: "file_url",
    label: "DPP Sheet (Google Drive Link or Upload PDF)",
    type: "document",
    required: true,
    placeholder: "Google Drive share link paste karein ya PDF upload karein",
    helper: "💡 Teacher Tip: Google Drive share link ya device se direct DPP PDF upload karein.",
  },
  {
    name: "title",
    label: "DPP Title (शीट का नाम)",
    type: "text",
    required: true,
    placeholder: "e.g. DPP 01 - Varnamala Practice Questions",
  },
  {
    name: "batch_id",
    label: "Target Batch (किस बैच के लिए है?)",
    type: "batch",
    required: true,
    helper: "Select the batch where students will solve this DPP.",
  },
  {
    name: "subject",
    label: "Subject Folder (सब्जेक्ट)",
    type: "text",
    required: true,
    placeholder: "e.g. General Hindi, Mathematics, Reasoning",
  },
  {
    name: "chapter",
    label: "Chapter / Topic (चैप्टर)",
    type: "text",
    required: true,
    placeholder: "e.g. Varnamala, Number System",
  },
  {
    name: "description",
    label: "Description / Instructions (निर्देश - Optional)",
    type: "textarea",
    placeholder: "e.g. 25 questions, solve within 30 minutes",
  },
  {
    name: "is_free",
    label: "Make Free for Everyone (डेमो / फ्री प्रैक्टिस)",
    type: "boolean",
    helper: "If checked, this DPP will also be available publicly on the Free Resources page.",
  },
];

export const Route = createFileRoute("/_authenticated/admin/dpps")({
  component: () => (
    <ResourceManager<Material>
      table="study_materials"
      eyebrow="Admin"
      title="Daily Practice Problems"
      description="Upload and manage DPPs organized by Batch, Subject, and Chapter."
      columns={columns}
      fields={fields}
      defaults={{ material_type: "dpp", is_free: false }}
      presetFilter={{ column: "material_type", value: "dpp" }}
      searchKeys={["title", "subject", "chapter"]}
      headerBanner={<MaterialNavSwitcher current="dpps" />}
    />
  ),
});
