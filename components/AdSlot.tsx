"use client";

import { useEffect, useRef } from "react";

type Props = {
  slot?: string;
  format?: "auto" | "rectangle" | "vertical" | "horizontal";
  className?: string;
  /** Show a visible placeholder when no AdSense client/slot is configured. */
  showPlaceholder?: boolean;
  /** Optional label shown on top of the slot. */
  label?: string;
};

/**
 * Universal Google AdSense slot.
 * - Pulls client ID from NEXT_PUBLIC_ADSENSE_CLIENT
 * - If no client/slot is configured, renders a clearly-labeled placeholder so
 *   you can see exactly where the ads will go in the layout.
 */
export default function AdSlot({
  slot,
  format = "auto",
  className = "",
  showPlaceholder = true,
  label = "Advertisement"
}: Props) {
  const ref = useRef<HTMLModElement>(null);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const enabled = Boolean(client && slot);

  useEffect(() => {
    if (!enabled) return;
    try {
      // @ts-expect-error - AdSense pushes onto a global array
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, [enabled]);

  if (!enabled) {
    if (!showPlaceholder) return null;
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-bg-line bg-bg-soft/50 p-4 text-xs uppercase tracking-widest text-white/40 ${className}`}
        style={{ minHeight: 90 }}
      >
        {label} · slot ready
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-white/30">
        {label}
      </div>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
