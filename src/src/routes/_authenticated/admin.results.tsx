import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type ResultRow = {
  id: string; student_name: string; exam_name: string; rank_or_marks: string | null;
  year: number | null; is_featured: boolean;
};

const columns: Column<ResultRow>[] = [
  { key: "student_name", label: "Student", render: (r) => <span className="font-medium">{r.student_name}</span> },
  { key: "exam_name", label: "Exam" },
  { key: "rank_or_marks", label: "Rank / Marks" },
  { key: "year", label: "Year" },
  { key: "is_featured", label: "Featured", render: (r) => (r.is_featured ? "★" : "—") },
];

const fields: Field[] = [
  { name: "student_name", label: "Student Name", type: "text", required: true },
  { name: "exam_name", label: "Exam Name", type: "text", required: true, placeholder: "e.g. UP Police Constable" },
  { name: "rank_or_marks", label: "Rank / Marks", type: "text", placeholder: "e.g. Rank 42 / 98.5%" },
  { name: "year", label: "Year", type: "number" },
  { name: "photo_url", label: "Photo", type: "image", bucket: "faculty-photos", helper: "Optional student photo" },
  { name: "testimonial", label: "Testimonial", type: "textarea", placeholder: "What the student said about their prep" },
  { name: "sort_order", label: "Sort Order", type: "number", helper: "Lower numbers appear first" },
  { name: "is_featured", label: "Featured", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/results")({
  component: () => (
    <ResourceManager<ResultRow>
      table="results"
      eyebrow="Admin"
      title="Results"
      description="Manage selections and testimonials shown on the Results page."
      columns={columns}
      fields={fields}
      defaults={{ is_featured: false, sort_order: 0 }}
      searchKeys={["student_name", "exam_name"]}
      orderBy={{ column: "sort_order", ascending: true }}
    />
  ),
});
