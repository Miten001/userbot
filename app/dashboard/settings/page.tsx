"use client";

import { useEffect, useState } from "react";
import {
  Settings, Camera, User, Globe, Phone, Mail, Lock,
  Bell, AlertTriangle, Trash2, Save,
} from "lucide-react";
import { Profile, DEMO_PROFILE } from "@/app/dashboard/data";
import PageTransition from "@/app/components/PageTransition";
import { SkeletonCard } from "@/app/components/SkeletonCard";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Preferences
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [tradeAlerts, setTradeAlerts] = useState(true);
  const [payoutNotifs, setPayoutNotifs] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (!r.ok) throw new Error("not configured");
        const data = await r.json();
        setProfile(data.profile);
        setEmail(data.email ?? null);
        setFullName(data.profile?.full_name ?? "");
        setCountry(data.profile?.country ?? "");
        setPhone(data.profile?.phone ?? "");
        setDemo(false);
      } catch {
        setProfile(DEMO_PROFILE);
        setEmail("alex@example.com");
        setFullName(DEMO_PROFILE.full_name ?? "");
        setCountry(DEMO_PROFILE.country ?? "");
        setPhone(DEMO_PROFILE.phone ?? "");
        setDemo(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      if (demo) {
        setProfile({ id: "demo", full_name: fullName, country, phone, is_admin: profile?.is_admin });
        flash("ok", "Profile updated.");
        return;
      }
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: fullName, country, phone }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Failed to save");
      setProfile(body.profile);
      flash("ok", "Profile updated.");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden pb-24">
        <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
        <div className="relative mx-auto w-full max-w-3xl">
          <SkeletonCard height="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-3xl">
        <PageTransition>
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            <span className="gradient-text">Settings</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Manage your account and preferences</p>
        </div>

        {/* Personal Info Section */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2">
            <User className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg font-bold text-white">Personal Info</h2>
          </div>

          {/* Avatar Upload */}
          <div className="mb-6 flex items-center gap-5">
            <label className="group relative cursor-pointer">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/20 bg-white/5 transition-colors group-hover:border-gold/50">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-slate-500" />
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
            <div>
              <p className="text-sm font-medium text-white">Profile Photo</p>
              <p className="text-xs text-slate-400">Click to upload. JPG, PNG up to 2MB.</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Preview only - persistence coming soon.</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <Field label="Full Name" icon={User}>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Your full name" />
            </Field>
            <Field label="Country" icon={Globe}>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="e.g. United Arab Emirates" />
            </Field>
            <Field label="Phone" icon={Phone}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+1 555 000 0000" />
            </Field>
          </div>

          <button onClick={saveProfile} disabled={saving} className="btn-primary mt-5 justify-center disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </section>

        {/* Account Section */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2">
            <Settings className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg font-bold text-white">Account</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <Mail className="h-3.5 w-3.5" /> Email
              </label>
              <div className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-400">
                {email ?? "Not set"}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Email cannot be changed from here.</p>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <Lock className="h-3.5 w-3.5" /> Password
              </label>
              <div className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-500">
                ********
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Password changes are handled via your identity provider.</p>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2">
            <Bell className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg font-bold text-white">Preferences</h2>
          </div>
          <p className="mb-4 text-xs text-slate-500">Notification preferences are cosmetic for now - persistence coming soon.</p>

          <div className="space-y-4">
            <Toggle label="Email Notifications" description="Receive updates about your account via email" checked={emailNotifs} onChange={setEmailNotifs} />
            <Toggle label="Trade Alerts" description="Get notified when trades open or close" checked={tradeAlerts} onChange={setTradeAlerts} />
            <Toggle label="Payout Notifications" description="Alerts when payouts are processed" checked={payoutNotifs} onChange={setPayoutNotifs} />
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-3xl border border-rose2/30 bg-rose2/[0.04] p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose2-400" />
            <h2 className="font-display text-lg font-bold text-rose2-400">Danger Zone</h2>
          </div>
          <p className="mb-4 text-sm text-slate-400">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button className="inline-flex items-center gap-2 rounded-full border border-rose2/40 bg-rose2/10 px-4 py-2.5 text-sm font-semibold text-rose2-400 transition-colors hover:bg-rose2/20">
            <Trash2 className="h-4 w-4" /> Delete Account
          </button>
        </section>
        </PageTransition>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border px-5 py-2.5 text-sm font-semibold backdrop-blur-xl ${toast.kind === "ok" ? "border-emerald2/40 bg-emerald2/15 text-emerald2-400" : "border-rose2/40 bg-rose2/15 text-rose2-400"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---- Small components ---- */

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-gold/50";

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-gold" : "bg-white/10"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
