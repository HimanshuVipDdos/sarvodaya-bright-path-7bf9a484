import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type Material = {
  id: string; title: string; material_type: string; subject: string | null;
  chapter: string | null; is_free: boolean; file_url: string | null;
};

const columns: Column<Material>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
  { key: "subject", label: "Subject" },
  { key: "chapter", label: "Chapter" },
  { key: "is_free", label: "Free", render: (r) => (r.is_free ? "✓" : "—") },
  { key: "file_url", label: "File", render: (r) => r.file_url
      ? <a href={r.file_url} target="_blank" rel="noreferrer" className="text-primary underline">Open</a>
      : "—" },
];

const typeOptions = [
  { value: "pdf", label: "PDF" },
  { value: "notes", label: "Notes" },
  { value: "pyq", label: "Previous Year Paper" },
  { value: "answer_key", label: "Answer Key" },
];

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "material_type", label: "Type", type: "select", options: typeOptions, required: true },
  { name: "batch_id", label: "Batch", type: "batch" },
  { name: "subject", label: "Subject", type: "text" },
  { name: "chapter", label: "Chapter", type: "text" },
  { name: "file_url", label: "File URL", type: "url", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "is_free", label: "Free for everyone", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/pdfs")({
  component: () => (
    <ResourceManager<Material>
      table="study_materials"
      eyebrow="Admin"
      title="PDFs & Notes"
      description="PDFs, notes, previous-year papers and answer keys."
      columns={columns}
      fields={fields}
      defaults={{ material_type: "pdf", is_free: false }}
      searchKeys={["title", "subject", "chapter"]}
    />
  ),
});
