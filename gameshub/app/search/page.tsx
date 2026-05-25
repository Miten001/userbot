import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameGrid from "@/components/GameGrid";
import CategoryStrip from "@/components/CategoryStrip";
import AdSlot from "@/components/AdSlot";
import SearchBar from "@/components/SearchBar";
import { searchGames } from "@/lib/games";

export const metadata: Metadata = {
  title: "Search Games",
  description: "Find your next favorite browser game."
};

export default async function SearchPage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const results = q ? await searchGames(q) : [];

  return (
    <main>
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <CategoryStrip />

        <div className="mt-6 rounded-2xl border border-bg-line bg-bg-card p-6">
          <h1 className="font-display text-2xl font-bold text-white">
            {q ? (
              <>
                Search results for{" "}
                <span className="text-brand-400">&ldquo;{q}&rdquo;</span>
              </>
            ) : (
              "Search games"
            )}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {q
              ? `${results.length} ${results.length === 1 ? "game" : "games"} match your search.`
              : "Type something to find a game."}
          </p>
          <div className="mt-4 max-w-xl">
            <SearchBar defaultValue={q} />
          </div>
        </div>

        <AdSlot
          slot={process.env.NEXT_PUBLIC_AD_SLOT_HEADER}
          className="my-6"
          label="Top banner"
        />

        {q && (
          <GameGrid
            games={results}
            emptyMessage={`No games found for "${q}". Try a different keyword.`}
          />
        )}

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
