import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type Material = {
  id: string; title: string; subject: string | null; chapter: string | null;
  is_free: boolean; file_url: string | null;
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

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "batch_id", label: "Batch", type: "batch" },
  { name: "subject", label: "Subject", type: "text" },
  { name: "chapter", label: "Chapter", type: "text" },
  { name: "file_url", label: "File URL", type: "url", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "is_free", label: "Free for everyone", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/dpps")({
  component: () => (
    <ResourceManager<Material>
      table="study_materials"
      eyebrow="Admin"
      title="Daily Practice Problems"
      description="Upload DPPs linked to a batch and subject."
      columns={columns}
      fields={fields}
      defaults={{ material_type: "dpp", is_free: false }}
      presetFilter={{ column: "material_type", value: "dpp" }}
      searchKeys={["title", "subject", "chapter"]}
    />
  ),
});
