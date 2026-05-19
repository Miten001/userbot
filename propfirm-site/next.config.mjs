/** @type {import('next').NextConfig} */
const isPages = process.env.GITHUB_PAGES === "true";
const repoBasePath = "/userbot"; // GitHub Pages serves project pages at /<repo>/

const nextConfig = {
  reactStrictMode: true,

  // Static export when building for GitHub Pages
  ...(isPages
    ? {
        output: "export",
        basePath: repoBasePath,
        assetPrefix: repoBasePath,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
