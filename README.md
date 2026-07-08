# Bench

A private, fully client-side toolbench — a single `index.html` with 16 real,
working tools (image compressor, images→PDF, age/date calculators, countdown
timer, clocks, JSON formatter, UUID/password generators, Base64, color
converter, coin flip, dice, random number, and word counter). Nothing uploads
anywhere; everything runs in the visitor's browser.

## Deploy to Vercel (two ways)

**Drag-and-drop (fastest, no CLI):**
1. Go to https://vercel.com/new
2. Choose "Deploy" → drag this `bench` folder in (or upload it as a zip)
3. Vercel detects it as a static site — no build command needed. Deploy.

**With the Vercel CLI:**
```bash
npm i -g vercel
cd bench
vercel        # preview deploy
vercel --prod # production deploy
```

That's it — it's a static site, so there's no framework, no build step, and
no environment variables required.
