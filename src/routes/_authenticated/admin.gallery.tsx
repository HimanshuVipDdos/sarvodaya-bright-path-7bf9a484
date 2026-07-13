import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type GalleryRow = {
  id: string; title: string | null; image_url: string; category: string | null;
};

const columns: Column<GalleryRow>[] = [
  {
    key: "image_url", label: "Preview",
    render: (r) => (
      <img src={r.image_url} alt={r.title ?? "Gallery"} className="h-10 w-16 rounded-md object-cover" />
    ),
  },
  { key: "title", label: "Title", render: (r) => r.title || "—" },
  { key: "category", label: "Category" },
];

const fields: Field[] = [
  { name: "image_url", label: "Photo", type: "image", bucket: "gallery-photos", required: true },
  { name: "title", label: "Title", type: "text", placeholder: "e.g. Annual Function 2026" },
  { name: "category", label: "Category", type: "text", placeholder: "e.g. Campus, Events, Seminars" },
  { name: "sort_order", label: "Sort Order", type: "number", helper: "Lower numbers appear first" },
];

export const Route = createFileRoute("/_authenticated/admin/gallery")({
  component: () => (
    <ResourceManager<GalleryRow>
      table="gallery"
      eyebrow="Admin"
      title="Gallery"
      description="Manage photos shown on the Gallery page."
      columns={columns}
      fields={fields}
      defaults={{ sort_order: 0 }}
      searchKeys={["title", "category"]}
      orderBy={{ column: "sort_order", ascending: true }}
    />
  ),
});
