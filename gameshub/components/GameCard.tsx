import Link from "next/link";
import { Star } from "lucide-react";
import { Game } from "@/lib/types";

export default function GameCard({ game }: { game: Game }) {
  return (
    <Link
      href={`/game/${game.slug}`}
      className="group relative block overflow-hidden rounded-xl border border-bg-line bg-bg-card transition hover:-translate-y-1 hover:border-brand hover:shadow-glow"
    >
      <div className="relative aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.thumbnail}
          alt={game.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
        />

        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-transparent to-transparent opacity-80 transition group-hover:opacity-100" />

        {/* Badges (top-left) */}
        <div className="absolute left-2 top-2 flex gap-1">
          {game.new && (
            <span className="rounded-md bg-accent-lime/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-bg">
              New
            </span>
          )}
          {game.featured && (
            <span className="rounded-md bg-accent-pink/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
              Hot
            </span>
          )}
        </div>

        {/* Rating (top-right) */}
        {typeof game.rating === "number" && (
          <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-bg/80 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
            <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
            {game.rating.toFixed(1)}
          </div>
        )}

        {/* Title overlay */}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <h3 className="line-clamp-1 text-sm font-semibold text-white drop-shadow-lg">
            {game.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}
