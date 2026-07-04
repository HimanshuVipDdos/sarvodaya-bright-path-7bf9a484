import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type LiveClass = {
  id: string; title: string; scheduled_at: string; is_live: boolean; batch_id: string | null;
};

const columns: Column<LiveClass>[] = [
  { key: "title", label: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
  { key: "scheduled_at", label: "Scheduled", render: (r) => r.scheduled_at ? new Date(r.scheduled_at).toLocaleString("en-IN") : "—" },
  { key: "is_live", label: "Live", render: (r) => (r.is_live ? "🔴 Live" : "—") },
];

const fields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "batch_id", label: "Batch", type: "batch" },
  { name: "scheduled_at", label: "Scheduled At (ISO)", type: "text", placeholder: "2026-07-05T18:30:00+05:30", required: true, helper: "Full ISO datetime with timezone" },
  { name: "duration_minutes", label: "Duration (min)", type: "number", helper: "Used with auto-timer to end the class and save it as a recorded lecture" },
  { name: "auto_start", label: "Auto-start at scheduled time", type: "boolean", helper: "Automatically mark as LIVE when the timer hits" },
  { name: "auto_end", label: "Auto-end & save recording", type: "boolean", helper: "After duration, auto-unmark LIVE and copy to recorded lectures with the same title" },
  { name: "thumbnail_url", label: "Thumbnail URL", type: "url" },
  { name: "youtube_url", label: "YouTube Live URL / Embed", type: "url" },
  { name: "zoom_url", label: "Zoom URL", type: "url" },
  { name: "meet_url", label: "Google Meet URL", type: "url" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "is_live", label: "Mark as LIVE now (manual override)", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/live-classes")({
  component: () => (
    <ResourceManager<LiveClass>
      table="live_classes"
      eyebrow="Admin"
      title="Live Classes"
      description="Schedule and manage live classes for each batch."
      columns={columns}
      fields={fields}
      defaults={{ is_live: false, auto_start: true, auto_end: true, duration_minutes: 60 }}
      searchKeys={["title"]}
      orderBy={{ column: "scheduled_at", ascending: false }}
    />
  ),
});
