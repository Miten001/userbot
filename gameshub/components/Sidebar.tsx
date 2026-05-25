import Link from "next/link";
import {
  Home,
  Flame,
  Sparkles,
  TrendingUp,
  Heart,
  Gamepad2
} from "lucide-react";
import { categories } from "@/lib/categories";

/**
 * CrazyGames-style left sidebar.
 * Sticky on desktop, hidden on mobile (mobile users see CategoryStrip on the
 * homepage, which already gives them quick access to categories).
 */
export default function Sidebar({ activeCategory }: { activeCategory?: string }) {
  return (
    <aside className="hidden lg:block sticky top-16 h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-bg-line/60 bg-bg-soft/40 px-3 py-5">
      {/* Quick links */}
      <SidebarSection>
        <SidebarLink
          href="/"
          icon={<Home className="h-4 w-4" />}
          active={!activeCategory}
        >
          Home
        </SidebarLink>
        <SidebarLink
          href="/?tab=new"
          icon={<Sparkles className="h-4 w-4 text-accent-lime" />}
        >
          New
        </SidebarLink>
        <SidebarLink
          href="/?tab=popular"
          icon={<TrendingUp className="h-4 w-4 text-accent-cyan" />}
        >
          Popular
        </SidebarLink>
        <SidebarLink
          href="/?tab=featured"
          icon={<Flame className="h-4 w-4 text-accent-pink" />}
        >
          Featured
        </SidebarLink>
        <SidebarLink
          href="/?tab=favorites"
          icon={<Heart className="h-4 w-4 text-accent-orange" />}
        >
          Favorites
        </SidebarLink>
      </SidebarSection>

      {/* Categories */}
      <SidebarSection title="Categories">
        {categories.map((c) => (
          <SidebarLink
            key={c.slug}
            href={`/category/${c.slug}`}
            icon={<span className="text-base leading-none">{c.emoji}</span>}
            active={activeCategory === c.slug}
          >
            {c.name}
          </SidebarLink>
        ))}
      </SidebarSection>

      <div className="mt-8 rounded-xl border border-bg-line bg-bg-card/60 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
          <Gamepad2 className="h-4 w-4 text-brand-400" />
          1000+ free games
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-white/50">
          No download. No login. Just press play.
        </p>
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  children
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      {title && (
        <h4 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-white/40">
          {title}
        </h4>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  active,
  children
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand text-white shadow-glow"
          : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}
