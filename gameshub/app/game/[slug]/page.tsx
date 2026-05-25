import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Users, Tag, Gamepad2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameGrid from "@/components/GameGrid";
import SectionHeader from "@/components/SectionHeader";
import AdSlot from "@/components/AdSlot";
import GamePlayer from "./GamePlayer";
import {
  games,
  getGame,
  getGamesByCategory,
  getPopular
} from "@/lib/games";
import { getCategory } from "@/lib/categories";

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const g = getGame(params.slug);
  if (!g) return { title: "Game not found" };
  return {
    title: g.title,
    description: g.description,
    openGraph: {
      title: g.title,
      description: g.description,
      images: [g.thumbnail]
    },
    twitter: {
      card: "summary_large_image",
      title: g.title,
      description: g.description,
      images: [g.thumbnail]
    }
  };
}

export default function GamePage({ params }: Params) {
  const game = getGame(params.slug);
  if (!game) notFound();

  const cat = getCategory(game.category);
  const related = getGamesByCategory(game.category)
    .filter((g) => g.slug !== game.slug)
    .slice(0, 8);
  const more = getPopular(8).filter((g) => g.slug !== game.slug);

  return (
    <main>
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumbs */}
        <nav className="mb-4 flex items-center gap-1 text-sm text-white/50">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <span>/</span>
          {cat && (
            <>
              <Link
                href={`/category/${cat.slug}`}
                className="hover:text-white"
              >
                {cat.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-white">{game.title}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Player + info */}
          <div>
            <GamePlayer game={game} />

            {/* Title + meta */}
            <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-bold text-white">
                  {game.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/60">
                  {cat && (
                    <Link
                      href={`/category/${cat.slug}`}
                      className="flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-1 text-xs hover:text-white"
                    >
                      {cat.emoji} {cat.name}
                    </Link>
                  )}
                  {typeof game.rating === "number" && (
                    <span className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                      {game.rating.toFixed(1)} / 5
                    </span>
                  )}
                  {typeof game.plays === "number" && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {game.plays.toLocaleString()} plays
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* In-content ad */}
            <AdSlot
              slot={process.env.NEXT_PUBLIC_AD_SLOT_INCONTENT}
              className="mt-6"
              label="In-content"
            />

            {/* About */}
            <section className="mt-6 rounded-2xl border border-bg-line bg-bg-card p-5">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                <Gamepad2 className="h-4 w-4 text-brand-400" /> About this game
              </h2>
              <p className="text-sm leading-relaxed text-white/70">
                {game.description}
              </p>

              {game.controls && game.controls.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold text-white/80">
                    How to play
                  </h3>
                  <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-white/70 sm:grid-cols-2">
                    {game.controls.map((c) => (
                      <li
                        key={c}
                        className="flex items-center gap-2 rounded-lg bg-bg-soft px-3 py-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Tags */}
              {game.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-white/40" />
                  {game.tags.map((t) => (
                    <Link
                      key={t}
                      href={`/search?q=${encodeURIComponent(t)}`}
                      className="rounded-full bg-bg-soft px-3 py-1 text-xs text-white/70 transition hover:bg-brand hover:text-white"
                    >
                      #{t}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar with ads + related */}
          <aside className="space-y-6">
            <AdSlot
              slot={process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR}
              format="vertical"
              label="Sidebar"
              className="min-h-[260px]"
            />

            <div>
              <SectionHeader title="Related" emoji={cat?.emoji} />
              <div className="grid grid-cols-2 gap-3">
                {related.slice(0, 6).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/game/${g.slug}`}
                    className="group block overflow-hidden rounded-xl border border-bg-line bg-bg-card"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.thumbnail}
                        alt={g.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-110"
                      />
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-1 text-xs font-medium text-white">
                        {g.title}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* More games row */}
        <section className="mt-12">
          <SectionHeader title="More to play" emoji="🎮" href="/" />
          <GameGrid games={more} />
        </section>

        {/* Footer ad */}
        <AdSlot
          slot={process.env.NEXT_PUBLIC_AD_SLOT_FOOTER}
          className="mt-12"
          label="Footer banner"
        />
      </div>

      <Footer />
    </main>
  );
}
