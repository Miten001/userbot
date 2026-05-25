import Link from "next/link";
import { Play, Star } from "lucide-react";
import { Game } from "@/lib/types";

export default function GameCard({
  game,
  size = "md"
}: {
  game: Game;
  size?: "sm" | "md" | "lg";
}) {
  const dim = {
    sm: "aspect-[4/3]",
    md: "aspect-[4/3]",
    lg: "aspect-[16/9]"
  }[size];

  return (
    <Link
      href={`/game/${game.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-bg-line bg-bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-glow"
    >
      <div className={`relative ${dim} overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.thumbnail}
          alt={game.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
        />

        {/* Play overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/40 to-transparent opacity-90" />
        <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-glow">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </div>

        {/* Badges */}
        <div className="absolute left-2 top-2 flex gap-1">
          {game.new && (
            <span className="rounded-full bg-accent-lime/90 px-2 py-0.5 text-[10px] font-bold uppercase text-bg">
              New
            </span>
          )}
          {game.featured && (
            <span className="rounded-full bg-accent-pink/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Hot
            </span>
          )}
        </div>

        {/* Rating */}
        {typeof game.rating === "number" && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] text-white">
            <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
            {game.rating.toFixed(1)}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-white">
          {game.title}
        </h3>
        <p className="line-clamp-1 text-xs text-white/50">
          {game.tags.slice(0, 2).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
