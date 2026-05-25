import Link from "next/link";
import { Gamepad2, Flame, Sparkles, TrendingUp } from "lucide-react";
import SearchBar from "./SearchBar";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PlayHub";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-bg-line/60 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient shadow-glow">
            <Gamepad2 className="h-5 w-5 text-white" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-white">
            {SITE_NAME}
          </span>
        </Link>

        {/* Quick links */}
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <NavPill href="/?tab=new" icon={<Sparkles className="h-3.5 w-3.5" />}>
            New
          </NavPill>
          <NavPill href="/?tab=popular" icon={<TrendingUp className="h-3.5 w-3.5" />}>
            Popular
          </NavPill>
          <NavPill href="/?tab=featured" icon={<Flame className="h-3.5 w-3.5" />}>
            Featured
          </NavPill>
        </nav>

        {/* Search */}
        <div className="ml-auto w-full max-w-md">
          <SearchBar />
        </div>
      </div>
    </header>
  );
}

function NavPill({
  href,
  icon,
  children
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}
