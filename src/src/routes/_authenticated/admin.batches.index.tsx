import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";
import { Button } from "@/components/ui/button";

type BatchRow = {
  id: string; title: string; exam_category: string; fees_inr: number;
  is_active: boolean; is_featured: boolean;
};

const columns: Column<BatchRow>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
  { key: "exam_category", label: "Category" },
  { key: "fees_inr", label: "Fees", render: (r) => `₹${r.fees_inr.toLocaleString("en-IN")}` },
  { key: "is_active", label: "Active", render: (r) => (r.is_active ? "✓" : "—") },
  {
    key: "manage",
    label: "",
    render: (r) => (
      <Link to="/admin/batches/$batchId" params={{ batchId: r.id }}>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" /> Manage
        </Button>
      </Link>
    ),
  },
];

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "slug", label: "Slug", type: "text", required: true, placeholder: "e.g. up-police-2026" },
  { name: "exam_category", label: "Exam Category", type: "text", required: true, placeholder: "e.g. UP Police, SSC, Railway" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "duration", label: "Duration", type: "text", placeholder: "e.g. 6 months" },
  { name: "fees_inr", label: "Fees (₹)", type: "number", required: true },
  { name: "original_fees_inr", label: "Original Fees (₹)", type: "number", helper: "Shown as a strikethrough price" },
  { name: "subjects", label: "Subjects", type: "array", helper: "Comma separated" },
  { name: "faculty", label: "Faculty", type: "array", helper: "Comma separated names" },
  { name: "features", label: "Features", type: "array", helper: "Comma separated" },
  { name: "thumbnail_url", label: "Cover Photo", type: "image", bucket: "batch-thumbnails" },
  { name: "demo_video_url", label: "Demo Video URL", type: "url" },
  { name: "starts_on", label: "Starts On", type: "date" },
  { name: "is_featured", label: "Featured", type: "boolean" },
  { name: "is_active", label: "Active", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/batches/")({
  component: () => (
    <ResourceManager<BatchRow>
      table="batches"
      eyebrow="Admin"
      title="Batches"
      description="Create, edit, delete batches. Click Manage to configure CBT tests and view student rankings for a batch."
      columns={columns}
      fields={fields}
      defaults={{ is_active: true, is_featured: false, fees_inr: 0 }}
      searchKeys={["title", "exam_category"]}
      orderBy={{ column: "created_at", ascending: false }}
    />
  ),
});
