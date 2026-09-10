import { createFileRoute } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";
import { DocumentViewer } from "@/components/document-viewer";
import { Button } from "@/components/ui/button";

type Material = {
  id: string;
  title: string;
  material_type: string;
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
    key: "material_type",
    label: "Type",
    render: (r) => (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300">
        {r.material_type || "PDF"}
      </span>
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
    label: "Document",
    render: (r) =>
      r.file_url ? (
        <DocumentViewer
          url={r.file_url}
          title={r.title}
          trigger={
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-lg text-primary border-primary/30 hover:bg-primary/10 text-xs font-semibold"
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

const typeOptions = [
  { value: "pdf", label: "PDF" },
  { value: "notes", label: "Notes" },
  { value: "pyq", label: "Previous Year Paper" },
  { value: "answer_key", label: "Answer Key" },
];

const fields: Field[] = [
  { name: "title", label: "Title / Document Name", type: "text", required: true, placeholder: "e.g. Chapter 01 Class Notes (Handwritten)" },
  { name: "batch_id", label: "Target Batch", type: "batch", required: true, helper: "Select which batch students can access this material in." },
  { name: "subject", label: "Subject Folder", type: "text", required: true, placeholder: "e.g. General Hindi, Mathematics, Reasoning" },
  { name: "chapter", label: "Chapter / Topic", type: "text", required: true, placeholder: "e.g. Varnamala, Number System" },
  { name: "file_url", label: "PDF Document (Google Drive Link or Upload)", type: "document", required: true, helper: "Paste Google Drive share link (e.g. drive.google.com/...) or upload a PDF file." },
  { name: "material_type", label: "Material Type", type: "select", options: typeOptions, required: true },
  { name: "description", label: "Description / Notes", type: "textarea", placeholder: "Optional notes for students" },
  { name: "is_free", label: "Make Free for Everyone", type: "boolean", helper: "If checked, this document will also be available publicly on the Free Resources page." },
];

export const Route = createFileRoute("/_authenticated/admin/pdfs")({
  component: () => (
    <ResourceManager<Material>
      table="study_materials"
      eyebrow="Admin"
      title="PDFs & Notes"
      description="PDFs, notes, previous-year papers and answer keys organized by Batch, Subject, and Chapter."
      columns={columns}
      fields={fields}
      defaults={{ material_type: "pdf", is_free: false }}
      searchKeys={["title", "subject", "chapter"]}
    />
  ),
});
