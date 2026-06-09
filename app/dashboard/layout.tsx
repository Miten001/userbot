"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/app/components/DashboardLayout";
import { Profile } from "./data";

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          setProfile(data.profile);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      }
    })();
  }, []);

  return (
    <DashboardLayout
      isAdmin={profile?.is_admin}
      profileName={profile?.full_name ?? undefined}
    >
      {children}
    </DashboardLayout>
  );
}
