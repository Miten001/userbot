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

export default function HomePage() {
  const featured = getFeatured(5);
  const popular = getPopular(12);
  const fresh = getNew(6);

  return (
    <main>
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Top banner ad */}
        <AdSlot
          slot={process.env.NEXT_PUBLIC_AD_SLOT_HEADER}
          className="mb-6"
          label="Top banner"
        />

        {/* Categories */}
        <CategoryStrip />

        {/* Featured Hero */}
        <div className="mt-6">
          <Hero games={featured} />
        </div>

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
        {categories.map((c) => {
          const list = getGamesByCategory(c.slug).slice(0, 6);
          if (!list.length) return null;
          return (
            <section key={c.slug} className="mt-12">
              <SectionHeader
                title={c.name}
                emoji={c.emoji}
                href={`/category/${c.slug}`}
              />
              <GameGrid games={list} />
            </section>
          );
        })}

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
