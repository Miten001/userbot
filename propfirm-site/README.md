# ApexFunded — Forex Prop Firm Website

A premium, 3D-animated landing page for a forex proprietary trading firm, built with Next.js 14, TypeScript, Tailwind CSS, React Three Fiber, and Framer Motion.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for styling (glassmorphism + gradient utilities)
- **React Three Fiber** + **drei** for the animated 3D hero scene
- **Framer Motion** for scroll/hover animations
- **lucide-react** for icons
- Fonts: **Inter** (UI) + **Space Grotesk** (display)

## Sections

1. **Navbar** — sticky pill with scroll-aware glass blur, mobile drawer
2. **Hero** — animated 3D distorted icosahedron with orbit rings, particles & stars
3. **Stats + Partners marquee** — payouts, traders funded, countries, payout time
4. **Funding Plans** — 1-step / 2-step toggle, 5 challenge cards ($10K → $200K)
5. **How It Works** — 3 steps with raised icon plates
6. **Features** — bento grid with animated split meter, payout chips, country flags
7. **Trading Rules** — Allowed / Not Allowed side-by-side cards
8. **Testimonials** — 6 trader stories with payout pills
9. **FAQ** — animated accordion (8 questions)
10. **CTA** — conic-gradient border card with stat panel
11. **Footer** — newsletter, socials, risk disclaimer

## Getting started

```bash
cd propfirm-site
npm install
npm run dev
```

Open <http://localhost:3000>.

## Build

```bash
npm run build
npm run start
```

## Customization

- **Brand colors** — edit `tailwind.config.ts` (`accent`, `accent-green`, `accent-violet`)
- **Plans pricing** — edit `app/components/Plans.tsx` (`PLANS` constant)
- **Copy & stats** — each section component is fully self-contained
- **3D scene** — tune `app/components/Hero3D.tsx` (distortion, particles, orbits)

## Notes

- 3D hero is dynamically imported (`ssr: false`) for fast first paint
- All sections animate in on scroll via Framer Motion's `whileInView`
- Mobile-first responsive design from `sm` upward

---

Built with `<3` for traders.
