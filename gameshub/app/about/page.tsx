import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PlayHub";

export const metadata: Metadata = {
  title: "About",
  description: `Learn about ${SITE_NAME} — a free online HTML5 games portal.`
};

export default function AboutPage() {
  return (
    <main>
      <Navbar />
      <article className="mx-auto max-w-3xl px-4 py-12 text-white/70">
        <h1 className="font-display text-4xl font-bold text-white">
          About {SITE_NAME}
        </h1>
        <p className="text-white/70">
          {SITE_NAME} is a free online games portal where you can play hundreds
          of HTML5 games directly in your browser — no downloads, no installs,
          no logins required. We curate action, puzzle, racing, sports,
          shooting, .io and many more genres so there&apos;s always something
          new to play.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-white">Our mission</h2>
        <p className="text-white/70">
          To make the best of the open web instantly playable on any device.
          Every game on {SITE_NAME} is mobile-friendly, runs on a modern
          browser, and is free to play.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-white">Contact</h2>
        <p className="text-white/70">
          Got a game suggestion or a partnership idea? Email us at{" "}
          <a
            className="text-brand-400 underline"
            href="mailto:hello@example.com"
          >
            hello@example.com
          </a>
          .
        </p>
      </article>
      <Footer />
    </main>
  );
}
