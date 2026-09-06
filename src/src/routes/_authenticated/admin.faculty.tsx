import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type FacultyRow = {
  id: string; name: string; designation: string | null; qualification: string | null;
  subject: string | null; experience_years: number | null; is_active: boolean;
};

const columns: Column<FacultyRow>[] = [
  { key: "name", label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
  { key: "subject", label: "Subject" },
  { key: "qualification", label: "Qualification" },
  { key: "experience_years", label: "Experience", render: (r) => r.experience_years ? `${r.experience_years} yrs` : "—" },
  { key: "is_active", label: "Active", render: (r) => (r.is_active ? "✓" : "—") },
];

const fields: Field[] = [
  { name: "name", label: "Full Name", type: "text", required: true },
  { name: "photo_url", label: "Photo", type: "image", bucket: "faculty-photos", helper: "Upload a clear headshot photo" },
  { name: "subject", label: "Subject", type: "text", placeholder: "e.g. Mathematics, Reasoning, GS" },
  { name: "qualification", label: "Qualification", type: "text", placeholder: "e.g. M.Sc, B.Ed, PhD" },
  { name: "designation", label: "Designation", type: "text", placeholder: "e.g. Senior Faculty" },
  { name: "experience_years", label: "Experience (years)", type: "number" },
  { name: "bio", label: "Bio", type: "textarea", placeholder: "Short teaching background / achievements" },
  { name: "sort_order", label: "Sort Order", type: "number", helper: "Lower numbers appear first" },
  { name: "is_active", label: "Show on website", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/faculty")({
  component: () => (
    <ResourceManager<FacultyRow>
      table="faculty"
      eyebrow="Admin"
      title="Faculty"
      description="Manage teacher profiles shown on the Faculty page."
      columns={columns}
      fields={fields}
      defaults={{ is_active: true, sort_order: 0 }}
      searchKeys={["name", "subject"]}
      orderBy={{ column: "sort_order", ascending: true }}
    />
  ),
});
