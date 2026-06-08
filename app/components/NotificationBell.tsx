"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Wallet, Banknote, TrendingUp, Sparkles } from "lucide-react";

interface Notification {
  id: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  time: string;
}

const demoNotifications: Notification[] = [
  {
    id: 1,
    icon: Wallet,
    title: "Account Funded",
    description: "$50K account now active",
    time: "2 min ago",
  },
  {
    id: 2,
    icon: Banknote,
    title: "Payout Processed",
    description: "$1,240 sent to your wallet",
    time: "1 hour ago",
  },
  {
    id: 3,
    icon: TrendingUp,
    title: "Trade Closed",
    description: "XAUUSD +$1,596 profit",
    time: "3 hours ago",
  },
  {
    id: 4,
    icon: Sparkles,
    title: "New Challenge Available",
    description: "$100K Elite challenge unlocked",
    time: "5 hours ago",
  },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-gold/30 hover:text-gold"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose2 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-4 sm:right-auto sm:left-0 top-16 sm:top-12 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 rounded-2xl border border-white/10 bg-bg-soft/95 backdrop-blur-2xl shadow-glass overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-slate-200">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {demoNotifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
                  <n.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{n.title}</p>
                  <p className="text-xs text-slate-400 truncate">{n.description}</p>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{n.time}</span>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-white/[0.06]">
            <button
              onClick={() => {
                setUnreadCount(0);
                setOpen(false);
              }}
              className="w-full text-center text-xs font-medium text-gold hover:text-gold-glow transition-colors"
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
