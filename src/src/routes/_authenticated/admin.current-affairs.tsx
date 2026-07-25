import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type CA = {
  id: string; title: string; publish_date: string; is_active: boolean; pdf_url: string | null;
};

const columns: Column<CA>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
  { key: "publish_date", label: "Date" },
  { key: "is_active", label: "Active", render: (r) => (r.is_active ? "✓" : "—") },
  { key: "pdf_url", label: "PDF", render: (r) => r.pdf_url
      ? <a href={r.pdf_url} target="_blank" rel="noreferrer" className="text-primary underline">Open</a>
      : "—" },
];

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "publish_date", label: "Publish Date", type: "date", required: true },
  { name: "summary", label: "Summary", type: "textarea" },
  { name: "body", label: "Body", type: "textarea" },
  { name: "pdf_url", label: "PDF URL", type: "url" },
  { name: "is_active", label: "Active", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/current-affairs")({
  component: () => (
    <ResourceManager<CA>
      table="current_affairs"
      eyebrow="Admin"
      title="Current Affairs"
      description="Daily updates, weekly summaries and monthly PDFs."
      columns={columns}
      fields={fields}
      defaults={{ is_active: true, publish_date: new Date().toISOString().slice(0, 10) }}
      orderBy={{ column: "publish_date", ascending: false }}
      searchKeys={["title", "summary"]}
    />
  ),
});
