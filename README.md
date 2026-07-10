# Sarvodaya Adhyeta — Landing Page

Premium glassmorphism landing page for Sarvodaya Adhyeta, a coaching institute in Kasganj, UP.
Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Framer Motion.

## Design notes

- **Palette**: deep blue `#1456E8` + navy `#0A2A6B` on an off-white `#F4F8FC` base, per the brief.
- **Type**: Plus Jakarta Sans (display), Inter (body), IBM Plex Mono (stats, codes, dates) — the
  mono face echoes roll numbers and admit-card detailing.
- **Signature element**: course cards and the hero stat panel are styled like exam **admit cards**
  (perforated edge, roll-number tab, status badge) — grounding the glass UI in the actual world of
  the students this site serves, instead of generic SaaS glass cards.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Import it in Vercel — it auto-detects Next.js, no config needed.
3. Add environment variables from `.env.example` in Vercel's dashboard once you wire up Supabase/Razorpay.

## What's included

- Full responsive landing page: hero, about, why-choose-us, faculty, all 26 batch categories with
  filtering, results/achievements, testimonials, gallery, notifications, news, contact form with
  Google Maps embed, WhatsApp + call floating buttons, footer.
- Inquiry form posts to `/app/api/inquiries/route.ts` — currently logs to console; swap in a
  Supabase insert when ready (see TODO comment in that file).

## What's NOT included yet — and why

The full spec also asks for a student portal, admin panel, live classes, recorded lectures, mock
tests, Razorpay payments, and JWT auth. Each of those is a substantial application in its own
right (database schema, auth flows, file/video storage, payment webhooks) — building all of them
as working, tested code isn't something to compress into one pass alongside the landing page.

Suggested build order for the rest:

1. **Supabase schema** — tables for students, batches, lectures, live_classes, pdfs, mock_tests,
   results, inquiries, faculty, notifications, current_affairs.
2. **Auth** — Supabase Auth (email/mobile OTP) for students; a separate protected `/admin` route
   guarded by a role check.
3. **Student portal** (`/dashboard`) — purchased batches, live class viewer (YouTube/Zoom/Meet
   embeds with countdown), recorded lecture library with subject/chapter filters, PDF downloads,
   mock test engine with timer + negative marking + leaderboard.
4. **Admin panel** (`/admin`) — CRUD for every content type above, inquiry management, push
   notifications, theme/banner settings.
5. **Razorpay** — checkout on batch enroll, webhook to confirm payment, then unlock that batch in
   the student's `purchases` table so it appears in their dashboard automatically.

Happy to build any of these next, one module at a time.
