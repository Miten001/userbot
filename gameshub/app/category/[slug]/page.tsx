import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import GameGrid from "@/components/GameGrid";
import CategoryStrip from "@/components/CategoryStrip";
import AdSlot from "@/components/AdSlot";
import { categories, getCategory } from "@/lib/categories";
import { getGamesByCategory } from "@/lib/games";

type Params = { params: { slug: string } };

export const revalidate = 86400;

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const cat = getCategory(params.slug);
  if (!cat) return { title: "Category not found" };
  return {
    title: `${cat.name} Games`,
    description: `${cat.blurb} Play ${cat.name.toLowerCase()} games online for free, no download required.`
  };
}

export default async function CategoryPage({ params }: Params) {
  const cat = getCategory(params.slug);
  if (!cat) notFound();

  const list = await getGamesByCategory(params.slug);

  return (
    <main>
      <Navbar />

      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar activeCategory={params.slug} />

        <div className="min-w-0 flex-1 px-4 py-6 md:px-6">
          <div className="mb-4 lg:hidden">
            <CategoryStrip active={params.slug} />
          </div>

          {/* Header */}
          <div
            className={`overflow-hidden rounded-3xl border border-bg-line bg-gradient-to-br ${cat.color} p-8 md:p-12`}
          >
            <div className="text-6xl">{cat.emoji}</div>
            <h1 className="mt-2 font-display text-4xl font-bold text-white md:text-5xl">
              {cat.name} Games
            </h1>
            <p className="mt-2 max-w-xl text-white/90">{cat.blurb}</p>
            <p className="mt-2 text-sm text-white/80">
              {list.length} {list.length === 1 ? "game" : "games"} available
            </p>
          </div>

          <AdSlot
            slot={process.env.NEXT_PUBLIC_AD_SLOT_HEADER}
            className="my-6"
            label="Top banner"
          />

          <GameGrid
            games={list}
            emptyMessage="No games in this category yet — check back soon."
          />

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
