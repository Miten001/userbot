"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight } from "lucide-react";

const links = [
  { href: "#plans", label: "Funding" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Why us" },
  { href: "#rules", label: "Rules" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`flex w-full max-w-6xl items-center justify-between rounded-full border px-4 py-2.5 transition-all duration-300 sm:px-6 ${
          scrolled
            ? "border-white/10 bg-bg/70 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
            : "border-white/[0.06] bg-white/[0.02] backdrop-blur-md"
        }`}
      >
        <a href="#" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight">
            Apex<span className="gradient-text">Funded</span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href="#"
            className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
          >
            Log in
          </a>
          <a
            href="#plans"
            className="group inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-accent-green px-4 py-2 text-sm font-semibold text-bg shadow-[0_8px_24px_-8px_rgba(34,211,238,0.6)] transition-transform hover:-translate-y-0.5"
          >
            Get Funded
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-4 right-4 top-20 z-40 rounded-3xl border border-white/10 bg-bg-soft/90 p-4 backdrop-blur-2xl md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    onClick={() => setOpen(false)}
                    href={l.href}
                    className="block rounded-xl px-4 py-3 text-slate-200 hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="mt-2">
                <a href="#plans" className="btn-primary w-full">
                  Get Funded <ChevronRight className="h-4 w-4" />
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Logo() {
  return (
    <span className="relative grid h-9 w-9 place-items-center">
      <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent via-accent-violet to-accent-green opacity-90 blur-[6px]" />
      <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/20 bg-bg/80 backdrop-blur">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M4 18 L10 6 L14 14 L20 4"
            stroke="url(#g)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>
      </span>
    </span>
  );
}
