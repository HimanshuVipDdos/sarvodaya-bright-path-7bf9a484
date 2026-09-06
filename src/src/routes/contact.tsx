import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Mail, MessageCircle } from "lucide-react";
import { Section } from "@/components/section";
import { InquiryForm } from "@/components/inquiry-form";
import { SITE, whatsappHref, telHref } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Sarvodaya Adhyeta" },
      { name: "description", content: `Visit, call or message ${SITE.name} in Kasganj, Uttar Pradesh.` },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <Section eyebrow="Get in touch" title="We're here to help" description="Call, message or visit our centre — we typically reply within a few hours.">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="glass-strong space-y-4 rounded-3xl p-6 lg:col-span-2">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" />
            <div className="text-sm">{SITE.address}</div>
          </div>
          <a href={telHref()} className="flex items-center gap-3 text-sm hover:text-primary">
            <Phone className="h-5 w-5 text-primary" /> {SITE.phone}
          </a>
          <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 text-sm hover:text-primary">
            <Mail className="h-5 w-5 text-primary" /> {SITE.email}
          </a>
          <a href={whatsappHref()} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm hover:text-primary">
            <MessageCircle className="h-5 w-5 text-primary" /> WhatsApp Chat
          </a>
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <iframe
              title="Sarvodaya Adhyeta location"
              className="h-64 w-full"
              loading="lazy"
              src={`https://www.google.com/maps?q=${encodeURIComponent(SITE.mapsQuery)}&output=embed`}
            />
          </div>
        </div>
        <div className="glass-strong rounded-3xl p-6 lg:col-span-3">
          <h3 className="text-lg font-semibold">Send an inquiry</h3>
          <p className="text-sm text-muted-foreground">We typically reply within a few hours.</p>
          <div className="mt-5">
            <InquiryForm />
          </div>
        </div>
      </div>
    </Section>
  );
}
