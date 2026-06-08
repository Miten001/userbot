"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Wallet, BarChart3, Banknote,
  Settings, ShieldCheck, Home, User,
} from "lucide-react";

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
};

const mainLinks: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: Wallet, label: "Accounts", href: "/dashboard#accounts" },
  { icon: BarChart3, label: "Trades", href: "/dashboard#trades" },
  { icon: Banknote, label: "Payouts", href: "/dashboard#payouts" },
];

const adminLinks: NavItem[] = [
  { icon: ShieldCheck, label: "Admin Console", href: "/admin" },
];

export default function Sidebar({ isAdmin, onSettingsClick, profileName }: { isAdmin?: boolean; onSettingsClick?: () => void; profileName?: string }) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.href === "/admin") return pathname === "/admin";
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return false;
  }

  return (
    <aside className="flex h-full flex-col bg-bg-deep/95 border-r border-white/[0.06] backdrop-blur-2xl">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-6">
        <SidebarLogo />
        <span className="font-display text-lg font-bold tracking-tight">
          Apex<span className="gradient-text">Funded</span>
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-2">
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Menu
        </div>
        <ul className="space-y-1">
          {mainLinks.map((item) => {
            const active = isActive(item);

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-l-2 border-gold bg-gold/10 text-gold"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-gold/10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <item.icon className={`relative h-4 w-4 ${active ? "text-gold" : ""}`} />
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {onSettingsClick && (
            <li>
              <button
                onClick={onSettingsClick}
                className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </li>
          )}
        </ul>

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Admin
            </div>
            <ul className="space-y-1">
              {adminLinks.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "border-l-2 border-gold bg-gold/10 text-gold"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="sidebar-active-admin"
                          className="absolute inset-0 rounded-xl bg-gold/10"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                      )}
                      <item.icon className={`relative h-4 w-4 ${active ? "text-gold" : ""}`} />
                      <span className="relative">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* Bottom home link */}
      <div className="border-t border-white/[0.06] px-3 py-4">
        {profileName && (
          <div className="mb-2 flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300">
            <User className="h-4 w-4 text-gold" />
            <span className="truncate">{profileName}</span>
          </div>
        )}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200"
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </Link>
      </div>
    </aside>
  );
}

function SidebarLogo() {
  return (
    <span className="relative grid h-9 w-9 place-items-center">
      <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-gold-glow via-gold to-rose2 opacity-90 blur-[6px] animate-glow-pulse" />
      <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-gold/30 bg-bg-deep/80 backdrop-blur shadow-[inset_0_1px_0_rgba(251,191,36,0.4)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M4 18 L10 6 L14 14 L20 4"
            stroke="url(#sidebar-g)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="sidebar-g" x1="0" y1="0" x2="24" y2="24">
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
