"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight, Crown, LayoutDashboard, LogOut } from "lucide-react";
import { dbBrowser } from "@/lib/db";
import { SUPABASE_READY } from "@/app/components/AuthShell";

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
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Detect a logged-in session (live mode only).
  useEffect(() => {
    if (!SUPABASE_READY) return;
    let active = true;
    const supabase = dbBrowser();

    supabase.auth.getUser().then(({ data }) => {
      if (active) setAuthed(Boolean(data.user));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session?.user));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`flex w-full max-w-6xl items-center justify-between rounded-full border px-4 py-2.5 transition-all duration-300 sm:px-6 ${
          scrolled
            ? "border-gold/15 bg-bg-deep/80 shadow-[0_8px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(251,191,36,0.08)] backdrop-blur-2xl"
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
                className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-gold"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {authed ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-rose2/40 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
            >
              Log in
            </Link>
          )}
          <a href="#plans" className="btn-primary group !px-4 !py-2 !text-sm">
            <Crown className="h-3.5 w-3.5" />
            Get Funded
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-full border border-gold/20 bg-white/5 md:hidden"
        >
          {open ? <X className="h-5 w-5 text-gold" /> : <Menu className="h-5 w-5 text-gold" />}
        </button>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-4 right-4 top-20 z-40 rounded-3xl border border-gold/20 bg-bg-soft/95 p-4 shadow-gold backdrop-blur-2xl md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    onClick={() => setOpen(false)}
                    href={l.href}
                    className="block rounded-xl px-4 py-3 text-slate-200 transition-colors hover:bg-white/5 hover:text-gold"
                  >
                    {l.label}
                  </a>
                </li>
              ))}

              {authed ? (
                <>
                  <li>
                    <Link
                      onClick={() => setOpen(false)}
                      href="/dashboard"
                      className="flex items-center gap-2 rounded-xl px-4 py-3 text-slate-200 transition-colors hover:bg-white/5 hover:text-gold"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <form action="/auth/signout" method="post">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-slate-200 transition-colors hover:bg-white/5 hover:text-rose2-400"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </form>
                  </li>
                </>
              ) : (
                <li>
                  <Link
                    onClick={() => setOpen(false)}
                    href="/login"
                    className="block rounded-xl px-4 py-3 text-slate-200 transition-colors hover:bg-white/5 hover:text-gold"
                  >
                    Log in
                  </Link>
                </li>
              )}

              <li className="mt-2">
                <a
                  onClick={() => setOpen(false)}
                  href="#plans"
                  className="btn-primary w-full"
                >
                  <Crown className="h-4 w-4" />
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
      <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-gold-glow via-gold to-rose2 opacity-90 blur-[6px] animate-glow-pulse" />
      <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-gold/30 bg-bg-deep/80 backdrop-blur shadow-[inset_0_1px_0_rgba(251,191,36,0.4)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M4 18 L10 6 L14 14 L20 4"
            stroke="url(#g)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      </span>
    </span>
  );
}
