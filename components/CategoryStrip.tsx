import Link from "next/link";
import { categories } from "@/lib/categories";

export default function CategoryStrip({
  active
}: {
  active?: string;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href="/"
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
          !active
            ? "border-brand bg-brand text-white"
            : "border-bg-line bg-bg-soft text-white/70 hover:text-white"
        }`}
      >
        🎮 All
      </Link>
      {categories.map((c) => {
        const isActive = active === c.slug;
        return (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-brand bg-brand text-white"
                : "border-bg-line bg-bg-soft text-white/70 hover:text-white"
            }`}
          >
            <span>{c.emoji}</span>
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}
