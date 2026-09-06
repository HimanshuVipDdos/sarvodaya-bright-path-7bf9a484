import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type Notif = {
  id: string; title: string; category: string; exam_date: string | null;
  is_active: boolean; link_url: string | null;
};

const columns: Column<Notif>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
  { key: "category", label: "Category" },
  { key: "exam_date", label: "Date" },
  { key: "is_active", label: "Active", render: (r) => (r.is_active ? "✓" : "—") },
  { key: "link_url", label: "Link", render: (r) => r.link_url
      ? <a href={r.link_url} target="_blank" rel="noreferrer" className="text-primary underline">Open</a>
      : "—" },
];

const categories = [
  "vacancy","admit_card","answer_key","result","exam_date","notification",
].map((c) => ({ value: c, label: c.replace("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()) }));

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "category", label: "Category", type: "select", options: categories, required: true },
  { name: "exam_date", label: "Date", type: "date" },
  { name: "link_url", label: "Link URL", type: "url" },
  { name: "body", label: "Body", type: "textarea" },
  { name: "is_active", label: "Active", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: () => (
    <ResourceManager<Notif>
      table="notifications"
      eyebrow="Admin"
      title="Notifications"
      description="Vacancies, admit cards, answer keys, results and exam dates."
      columns={columns}
      fields={fields}
      defaults={{ is_active: true, category: "vacancy" }}
      searchKeys={["title", "category"]}
    />
  ),
});
