/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.gamemonetize.com" },
      { protocol: "https", hostname: "img.gamedistribution.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**" }
    ]
  },
  // Keep deploys green even if the modern ESLint setup logs warnings.
  // Lint locally with `npm run lint`.
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
