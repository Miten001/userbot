"use client";

import { Twitter, Instagram, Youtube, Send, Linkedin } from "lucide-react";

const cols = [
  {
    title: "Product",
    links: [
      { label: "Funding Plans", href: "#plans" },
      { label: "How it works", href: "#how" },
      { label: "Trading Rules", href: "#rules" },
      { label: "Scaling Plan", href: "#" },
      { label: "Affiliate", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Trader Dashboard", href: "#" },
      { label: "Help Center", href: "#" },
      { label: "Trading Glossary", href: "#" },
      { label: "Status", href: "#" },
      { label: "API", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Risk Disclosure", href: "#" },
      { label: "AML Policy", href: "#" },
      { label: "Cookies", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-bg-soft/50 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="font-display text-xl font-bold">
                Apex<span className="gradient-text">Funded</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-slate-400">
              Trade with our capital. Keep up to 90% of the profits.
              Industry-best splits, transparent rules, and the fastest payouts
              in prop trading.
            </p>

            {/* Newsletter */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-6 flex max-w-sm items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur"
            >
              <input
                type="email"
                placeholder="you@trader.com"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-green px-4 py-2 text-xs font-semibold text-bg shadow-[0_8px_20px_-8px_rgba(34,211,238,0.6)] transition-transform hover:-translate-y-0.5"
              >
                Subscribe
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>

            <div className="mt-6 flex items-center gap-2">
              {[Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link cols */}
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
                {c.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Risk disclaimer */}
        <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-xs leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-300">
            Risk Disclosure:
          </span>{" "}
          Trading foreign exchange and CFDs carries a high level of risk to
          your capital. Only trade with funds you can afford to lose. Past
          performance is not indicative of future results. ApexFunded does not
          provide trading services to retail clients — challenges are
          educational evaluations of trading skill.
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-slate-500 sm:flex-row">
          <div>© {new Date().getFullYear()} ApexFunded Capital Ltd. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green" />
              All systems operational
            </span>
            <span>v1.4.2</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Logo() {
  return (
    <span className="relative grid h-8 w-8 place-items-center">
      <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent via-accent-violet to-accent-green opacity-90 blur-[5px]" />
      <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-bg/80 backdrop-blur">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M4 18 L10 6 L14 14 L20 4"
            stroke="url(#fg)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="fg" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>
      </span>
    </span>
  );
}
