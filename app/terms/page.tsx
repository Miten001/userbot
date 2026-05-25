import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PlayHub";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of service for ${SITE_NAME}.`
};

export default function TermsPage() {
  return (
    <main>
      <Navbar />
      <article className="mx-auto max-w-3xl px-4 py-12 text-white/70">
        <h1 className="font-display text-4xl font-bold text-white">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-white/40">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <h2 className="mt-8 text-2xl font-semibold text-white">Acceptance</h2>
        <p>
          By using {SITE_NAME} you agree to these terms. If you do not agree,
          please do not use the site.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          Acceptable use
        </h2>
        <p>
          You agree not to disrupt the service, attempt to reverse-engineer
          embedded games, or use the site for any unlawful purpose.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">Content</h2>
        <p>
          Games featured on {SITE_NAME} are the property of their respective
          owners and are embedded under the terms provided by the original
          publishers. {SITE_NAME} is not affiliated with the developers of any
          game unless explicitly stated.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          Disclaimer of warranties
        </h2>
        <p>
          {SITE_NAME} is provided &ldquo;as is&rdquo; without warranties of
          any kind. We do not guarantee uninterrupted, error-free operation
          and are not liable for any damages arising from use of the site.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">Changes</h2>
        <p>
          We may update these terms from time to time. Continued use of the
          site after changes constitutes acceptance of the updated terms.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">Contact</h2>
        <p>
          Questions? Email{" "}
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
