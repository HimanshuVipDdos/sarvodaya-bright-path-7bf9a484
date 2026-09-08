import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type Lecture = {
  id: string; title: string; subject: string | null; chapter: string | null;
  lecture_number: number | null; is_published: boolean; batch_id: string | null;
  faculty: string | null;
};

const columns: Column<Lecture>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
  { key: "faculty", label: "Faculty", render: (r) => r.faculty || "—" },
  { key: "subject", label: "Subject" },
  { key: "chapter", label: "Chapter" },
  { key: "lecture_number", label: "#" },
  { key: "is_published", label: "Published", render: (r) => (r.is_published ? "✓" : "—") },
];

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "batch_id", label: "Batch", type: "batch" },
  { name: "faculty", label: "Faculty / Teacher Name", type: "text", placeholder: "Select or type teacher name (e.g. Anurag Sir)" },
  { name: "subject", label: "Subject", type: "text" },
  { name: "chapter", label: "Chapter", type: "text" },
  { name: "lecture_number", label: "Lecture #", type: "number" },
  { name: "duration_minutes", label: "Duration (min)", type: "number" },
  { name: "thumbnail_url", label: "Thumbnail / Cover Image", type: "image", bucket: "public", aspect: 16/9 },
  { name: "video_url", label: "Video / Embed URL", type: "url" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "is_published", label: "Published", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/lectures")({
  component: () => (
    <ResourceManager<Lecture>
      table="lectures"
      eyebrow="Admin"
      title="Recorded Lectures"
      description="Upload and manage recorded lectures linked to a batch."
      columns={columns}
      fields={fields}
      defaults={{ is_published: true }}
      searchKeys={["title", "subject", "chapter", "faculty"]}
    />
  ),
});
