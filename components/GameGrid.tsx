import { Game } from "@/lib/types";
import GameCard from "./GameCard";

export default function GameGrid({
  games,
  emptyMessage = "No games found."
}: {
  games: Game[];
  emptyMessage?: string;
}) {
  if (!games.length) {
    return (
      <div className="rounded-2xl border border-dashed border-bg-line p-10 text-center text-white/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {games.map((g) => (
        <GameCard key={g.slug} game={g} />
      ))}
    </div>
  );
}
