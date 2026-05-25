import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
    getPopular(18),
    getNew(6)
  ]);

  // Pull a row per category in parallel
  const categoryRows = await Promise.all(
    categories.map(async (c) => ({
      cat: c,
      games: (await getGamesByCategory(c.slug)).slice(0, 6)
    }))
  );

  return (
    <main>
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <AdSlot
          slot={process.env.NEXT_PUBLIC_AD_SLOT_HEADER}
          className="mb-6"
          label="Top banner"
        />

        <CategoryStrip />

        <div className="mt-6">
          <Hero games={featured} />
        </div>

        <section className="mt-10">
          <SectionHeader title="Popular Games" emoji="🔥" />
          <GameGrid games={popular} />
        </section>

        <AdSlot
          slot={process.env.NEXT_PUBLIC_AD_SLOT_INCONTENT}
          className="my-10"
          label="In-content"
        />

        {fresh.length > 0 && (
          <section className="mt-10">
            <SectionHeader title="New Games" emoji="✨" />
            <GameGrid games={fresh} />
          </section>
        )}

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
