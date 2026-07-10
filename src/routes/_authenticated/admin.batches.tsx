import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type Batch = {
  id: string; slug: string; title: string; exam_category: string;
  fees_inr: number; is_active: boolean; is_featured: boolean;
};

const columns: Column<Batch>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
  { key: "exam_category", label: "Category" },
  { key: "slug", label: "Slug", className: "text-muted-foreground" },
  { key: "fees_inr", label: "Fees", render: (r) => `₹${r.fees_inr.toLocaleString("en-IN")}` },
  { key: "is_active", label: "Active", render: (r) => (r.is_active ? "✓" : "—") },
  { key: "is_featured", label: "Featured", render: (r) => (r.is_featured ? "★" : "—") },
];

const categories = ["UP Police","UPSSSC","UPPSC","Teaching","SSC","Railway","Banking","State Level"];

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "slug", label: "Slug", type: "text", required: true, helper: "URL-safe, e.g. up-police-constable" },
  { name: "exam_category", label: "Category", type: "select", options: categories.map((c) => ({ value: c, label: c })) },
  { name: "duration", label: "Duration", type: "text", placeholder: "6 Months" },
  { name: "fees_inr", label: "Fees (₹)", type: "number" },
  { name: "original_fees_inr", label: "Original Fees (₹)", type: "number" },
  { name: "starts_on", label: "Starts On", type: "date" },
  { name: "thumbnail_url", label: "Thumbnail URL", type: "url" },
  { name: "demo_video_url", label: "Demo Video URL", type: "url" },
  { name: "subjects", label: "Subjects", type: "array" },
  { name: "faculty", label: "Faculty", type: "array" },
  { name: "features", label: "Features", type: "array" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "is_active", label: "Active", type: "boolean" },
  { name: "is_featured", label: "Featured", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/batches")({
  component: () => (
    <ResourceManager<Batch>
      table="batches"
      eyebrow="Admin"
      title="Batches"
      description="Create, edit and archive competitive exam batches."
      columns={columns}
      fields={fields}
      defaults={{ is_active: true, is_featured: false, fees_inr: 0 }}
      searchKeys={["title", "slug", "exam_category"]}
      orderBy={{ column: "title", ascending: true }}
    />
  ),
});
