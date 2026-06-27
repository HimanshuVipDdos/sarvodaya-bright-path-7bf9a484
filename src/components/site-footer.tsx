import { Link } from "@tanstack/react-router";
import { GraduationCap, MapPin, Phone, Mail } from "lucide-react";
import { NAV, SITE, whatsappHref } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="glass-strong rounded-3xl p-8 sm:p-12">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="text-lg font-semibold tracking-tight">{SITE.name}</div>
              </div>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                Mentoring competitive exam aspirants of Kasganj and Uttar Pradesh with
                disciplined teaching, daily practice, and premium digital learning tools.
              </p>
              <div className="mt-5 space-y-2 text-sm text-foreground/80">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{SITE.address}</span>
                </div>
                <a className="flex items-center gap-2 hover:text-primary" href={`tel:${SITE.phoneDigits}`}>
                  <Phone className="h-4 w-4 text-primary" /> {SITE.phone}
                </a>
                <a className="flex items-center gap-2 hover:text-primary" href={`mailto:${SITE.email}`}>
                  <Mail className="h-4 w-4 text-primary" /> {SITE.email}
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Explore</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {NAV.slice(0, 6).map((n) => (
                  <li key={n.to}>
                    <Link to={n.to} className="hover:text-primary">{n.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Quick Links</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {NAV.slice(6).map((n) => (
                  <li key={n.to}>
                    <Link to={n.to} className="hover:text-primary">{n.label}</Link>
                  </li>
                ))}
                <li><a href={whatsappHref()} target="_blank" rel="noreferrer" className="hover:text-primary">WhatsApp</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <div>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</div>
            <div>Founded by {SITE.owner}</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
