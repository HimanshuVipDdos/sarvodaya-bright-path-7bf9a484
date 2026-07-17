import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type HeroSlideRow = {
  id: string;
  title: string | null;
  image_url: string;
  link_type: string;
  link_value: string | null;
  is_active: boolean;
};

const columns: Column<HeroSlideRow>[] = [
  {
    key: "image_url", label: "Preview",
    render: (r) => (
      <img src={r.image_url} alt={r.title ?? "Slide"} className="h-10 w-20 rounded-md object-cover" />
    ),
  },
  { key: "title", label: "Label", render: (r) => r.title || "—" },
  {
    key: "link_type", label: "Redirects to",
    render: (r) =>
      r.link_type === "whatsapp" ? `WhatsApp: ${r.link_value || "—"}` :
      r.link_type === "url" ? (r.link_value || "—") : "No link",
  },
  { key: "is_active", label: "Active", render: (r) => (r.is_active ? "Yes" : "No") },
];

const fields: Field[] = [
  { name: "image_url", label: "Slide Photo", type: "image", bucket: "hero-slides", required: true, aspect: 2320 / 464 },
  { name: "title", label: "Label (admin only, not shown on site)", type: "text", placeholder: "e.g. Yakeen Batch Promo" },
  {
    name: "link_type", label: "On click, redirect to", type: "select",
    options: [
      { value: "none", label: "No link (just show image)" },
      { value: "whatsapp", label: "WhatsApp Number" },
      { value: "url", label: "Website / Any Link" },
    ],
  },
  {
    name: "link_value", label: "Link value", type: "text",
    placeholder: "WhatsApp: 91XXXXXXXXXX  |  URL: https://example.com",
    helper: "For WhatsApp, enter number with country code (e.g. 919876543210) — no + or spaces. For a link, paste the full URL. Leave blank if 'No link' selected.",
  },
  { name: "sort_order", label: "Sort Order", type: "number", helper: "Lower numbers appear first in the slider" },
  { name: "is_active", label: "Show on homepage", type: "boolean" },
];

export const Route = createFileRoute("/_authenticated/admin/hero-slides")({
  component: () => (
    <ResourceManager<HeroSlideRow>
      table="hero_slides"
      eyebrow="Admin"
      title="Homepage Slider"
      description="Manage the promotional image slider shown at the top of the homepage."
      columns={columns}
      fields={fields}
      defaults={{ sort_order: 0, link_type: "none", is_active: true }}
      searchKeys={["title"]}
      orderBy={{ column: "sort_order", ascending: true }}
    />
  ),
});
