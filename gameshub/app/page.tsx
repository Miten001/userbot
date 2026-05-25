import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import Hero from "@/components/Hero";
import GameGrid from "@/components/GameGrid";
import SectionHeader from "@/components/SectionHeader";
import CategoryStrip from "@/components/CategoryStrip";
import AdSlot from "@/components/AdSlot";
import { categories } from "@/lib/categories";
import {
  getFeatured,
  getNew,
  getPopular,
  getGamesByCategory
} from "@/lib/games";

export const revalidate = 86400; // 1 day

export default async function HomePage() {
  const [featured, popular, fresh] = await Promise.all([
    getFeatured(5),
    getPopular(24),
    getNew(8)
  ]);

  // Pull a row per category in parallel
  const categoryRows = await Promise.all(
    categories.map(async (c) => ({
      cat: c,
      games: (await getGamesByCategory(c.slug)).slice(0, 8)
    }))
  );

  return (
    <main>
      <Navbar />

      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar />

        <div className="min-w-0 flex-1 px-4 py-6 md:px-6">
          {/* Mobile categories */}
          <div className="mb-4 lg:hidden">
            <CategoryStrip />
          </div>

          {/* Top banner ad */}
          <AdSlot
            slot={process.env.NEXT_PUBLIC_AD_SLOT_HEADER}
            className="mb-6"
            label="Top banner"
          />

          {/* Featured Hero */}
          <Hero games={featured} />

          {/* Popular */}
          <section className="mt-10">
            <SectionHeader title="Popular Games" emoji="🔥" />
            <GameGrid games={popular} />
          </section>

          {/* Mid-content ad */}
          <AdSlot
            slot={process.env.NEXT_PUBLIC_AD_SLOT_INCONTENT}
            className="my-10"
            label="In-content"
          />

          {/* New */}
          {fresh.length > 0 && (
            <section className="mt-10">
              <SectionHeader title="New Games" emoji="✨" />
              <GameGrid games={fresh} />
            </section>
          )}

          {/* Per-category rows */}
          {categoryRows.map(({ cat, games }) =>
            games.length === 0 ? null : (
              <section key={cat.slug} className="mt-12">
                <SectionHeader
                  title={cat.name}
                  emoji={cat.emoji}
                  href={`/category/${cat.slug}`}
                />
                <GameGrid games={games} />
              </section>
            )
          )}

          {/* Footer ad */}
          <AdSlot
            slot={process.env.NEXT_PUBLIC_AD_SLOT_FOOTER}
            className="mt-12"
            label="Footer banner"
          />
        </div>
      </div>

      <Footer />
    </main>
  );
}
