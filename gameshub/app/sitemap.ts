import type { MetadataRoute } from "next";
import { getAllGames } from "@/lib/games";
import { categories } from "@/lib/categories";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    "",
    "/about",
    "/privacy",
    "/terms",
    "/search"
  ].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.6
  }));

  const categoryUrls: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7
  }));

  const games = await getAllGames();
  const gameUrls: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${SITE_URL}/game/${g.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8
  }));

  return [...staticUrls, ...categoryUrls, ...gameUrls];
}
