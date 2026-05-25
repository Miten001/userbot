"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({
  defaultValue = "",
  className = ""
}: {
  defaultValue?: string;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = q.trim();
        if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }}
      className={`group relative flex items-center ${className}`}
    >
      <Search className="absolute left-3 h-4 w-4 text-white/40 group-focus-within:text-white" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search 35+ games..."
        className="w-full rounded-full border border-bg-line bg-bg-soft py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-brand"
      />
    </form>
  );
}
