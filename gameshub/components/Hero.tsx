import Link from "next/link";
import { Play, Star } from "lucide-react";
import { Game } from "@/lib/types";

export default function Hero({ games }: { games: Game[] }) {
  const main = games[0];
  const side = games.slice(1, 5);
  if (!main) return null;

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {/* Main hero card */}
      <Link
        href={`/game/${main.slug}`}
        className="group relative col-span-2 overflow-hidden rounded-2xl border border-bg-line bg-bg-card shadow-card"
      >
        <div className="relative aspect-[16/9] md:aspect-[16/8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.thumbnail}
            alt={main.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-bg/95 via-bg/40 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-accent-pink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                Featured
              </span>
              {typeof main.rating === "number" && (
                <span className="flex items-center gap-1 rounded-full bg-bg/70 px-2.5 py-0.5 text-xs text-white">
                  <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                  {main.rating.toFixed(1)}
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold text-white md:text-5xl">
              {main.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70 md:text-base">
              {main.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-glow">
              <Play className="h-4 w-4 fill-current" />
              Play now
            </span>
          </div>
        </div>
      </Link>

      {/* Side stack — 2x2 grid of smaller cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-rows-2">
        {side.map((g) => (
          <Link
            key={g.slug}
            href={`/game/${g.slug}`}
            className="group relative overflow-hidden rounded-xl border border-bg-line bg-bg-card transition hover:border-brand"
          >
            <div className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.thumbnail}
                alt={g.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg/95 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <h3 className="line-clamp-1 text-sm font-semibold text-white">
                  {g.title}
                </h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
