"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({
  children,
  isAdmin,
  profileName,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  profileName?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64">
        <Sidebar isAdmin={isAdmin} profileName={profileName} />
      </div>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.06] bg-bg-deep/95 px-4 backdrop-blur-2xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <MobileLogo />
          <span className="font-display text-lg font-bold tracking-tight">
            Apex<span className="gradient-text">Funded</span>
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-full border border-gold/20 bg-white/5"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-gold" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            >
              <Sidebar isAdmin={isAdmin} profileName={profileName} />
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-2 top-[72px] grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="w-full pt-16 lg:ml-64 lg:pt-0">
        <div className="p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function MobileLogo() {
  return (
    <span className="relative grid h-8 w-8 place-items-center">
      <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-gold-glow via-gold to-rose2 opacity-90 blur-[5px] animate-glow-pulse" />
      <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-gold/30 bg-bg-deep/80 backdrop-blur shadow-[inset_0_1px_0_rgba(251,191,36,0.4)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M4 18 L10 6 L14 14 L20 4"
            stroke="url(#mobile-g)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="mobile-g" x1="0" y1="0" x2="24" y2="24">
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
