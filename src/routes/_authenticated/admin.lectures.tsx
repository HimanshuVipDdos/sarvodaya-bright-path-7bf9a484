import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";
import { LectureLiveSwitcher } from "@/components/admin/lecture-live-switcher";

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
  {
    name: "video_url",
    label: "Video / Lecture Link (YouTube / Drive)",
    type: "url",
    required: true,
    placeholder: "YouTube link paste karein (e.g. https://youtu.be/... ya https://youtube.com/watch?v=...)",
    helper: "💡 Teacher Tip: YouTube link yahan paste karein. Thumbnail apne aap detect ho jayega.",
  },
  {
    name: "title",
    label: "Lecture Title (क्लास का नाम)",
    type: "text",
    required: true,
    placeholder: "e.g. Physics – Kinematics – Lecture 01",
  },
  {
    name: "batch_id",
    label: "Target Batch (किस बैच के लिए है?)",
    type: "batch",
  },
  {
    name: "faculty",
    label: "Faculty / Teacher Name (पढ़ाने वाले शिक्षक)",
    type: "text",
    placeholder: "Select or type teacher name (e.g. Anurag Sir)",
  },
  {
    name: "subject",
    label: "Subject (सब्जेक्ट)",
    type: "text",
    placeholder: "e.g. Physics",
  },
  {
    name: "chapter",
    label: "Chapter (चैप्टर)",
    type: "text",
    placeholder: "e.g. Kinematics",
  },
  {
    name: "lecture_number",
    label: "Lecture # (लेक्चर नंबर)",
    type: "number",
    placeholder: "e.g. 1",
  },
  {
    name: "thumbnail_url",
    label: "Custom Thumbnail / Cover (Optional)",
    type: "image",
    bucket: "batch-thumbnails",
    helper: "YouTube video ka thumbnail automatically lag jata hai. Agar badalna ho tabhi photo upload karein.",
  },
  {
    name: "duration_minutes",
    label: "Duration in Minutes (Optional)",
    type: "number",
    placeholder: "e.g. 60",
  },
  {
    name: "description",
    label: "Description (विवरण - Optional)",
    type: "textarea",
  },
  {
    name: "is_published",
    label: "Published (विद्यार्थियों को पोर्टल पर दिखे)",
    type: "boolean",
  },
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
      headerBanner={<LectureLiveSwitcher current="recorded" />}
    />
  ),
});
