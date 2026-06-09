"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/notifications", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          const items: Notification[] = data.notifications ?? [];
          setNotifications(items);
          setUnreadCount(items.filter((n) => !n.read).length);
        }
      } catch {
        // API not available or network error - show empty state
      }
    })();
  }, []);

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
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <BellOff className="h-8 w-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{n.title}</p>
                    <p className="text-xs text-slate-400 truncate">{n.description}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{n.time}</span>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
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
          )}
        </div>
      )}
    </div>
  );
}
