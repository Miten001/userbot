import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { categories } from "@/lib/categories";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PlayHub";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-bg-line/60 bg-bg-soft/40">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient">
                <Gamepad2 className="h-5 w-5 text-white" />
              </span>
              <span className="font-display text-xl font-bold text-white">
                {SITE_NAME}
              </span>
            </Link>
            <p className="mt-3 text-sm text-white/50">
              Free online HTML5 games for everyone. No downloads, no installs —
              just press play.
            </p>
          </div>

          <FooterCol title="Categories">
            {categories.slice(0, 6).map((c) => (
              <FooterLink key={c.slug} href={`/category/${c.slug}`}>
                {c.emoji} {c.name}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="More">
            {categories.slice(6).map((c) => (
              <FooterLink key={c.slug} href={`/category/${c.slug}`}>
                {c.emoji} {c.name}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Company">
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="mailto:hello@example.com">Contact</FooterLink>
          </FooterCol>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-bg-line/60 pt-6 text-xs text-white/40 md:flex-row">
          <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
          <p>Built with Next.js. Games are property of their respective owners.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/60">
        {title}
      </h4>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="text-white/60 transition hover:text-white">
        {children}
      </Link>
    </li>
  );
}
