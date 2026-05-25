import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function SectionHeader({
  title,
  emoji,
  href
}: {
  title: string;
  emoji?: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="font-display text-xl font-bold text-white md:text-2xl">
        {emoji && <span className="mr-2">{emoji}</span>}
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-white/60 transition hover:text-white"
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
