import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <main>
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <div className="text-7xl">🎮</div>
        <h1 className="mt-4 font-display text-4xl font-bold text-white">
          404 — Game Over
        </h1>
        <p className="mt-2 text-white/60">
          The page you were looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-glow"
        >
          Back to home
        </Link>
      </div>
      <Footer />
    </main>
  );
}
