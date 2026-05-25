import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PlayHub";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy policy for ${SITE_NAME}.`
};

export default function PrivacyPage() {
  return (
    <main>
      <Navbar />
      <article className="mx-auto max-w-3xl px-4 py-12 text-white/70">
        <h1 className="font-display text-4xl font-bold text-white">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-white/40">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <h2 className="mt-8 text-2xl font-semibold text-white">Overview</h2>
        <p>
          {SITE_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) values your privacy.
          We do not require an account to play games on this site. This page
          describes what limited data we collect and how third-party services
          we integrate with may collect data.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          Information we collect
        </h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Standard server logs (IP address, user-agent, referer) for security
            and abuse prevention.
          </li>
          <li>
            Anonymous analytics about which pages and games are popular, via
            Google Analytics (if enabled).
          </li>
        </ul>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          Third-party services
        </h2>
        <p>
          This site may show ads served by{" "}
          <strong className="text-white">Google AdSense</strong>. AdSense uses
          cookies to serve ads based on your prior visits to this and other
          websites. You can opt out of personalized advertising by visiting{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noreferrer"
            className="text-brand-400 underline"
          >
            Google Ads Settings
          </a>
          .
        </p>
        <p className="mt-3">
          Games are loaded inside iframes from third-party providers (such as
          gamemonetize.com or gamedistribution.com). Those providers may set
          their own cookies; please refer to their privacy policies.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">Cookies</h2>
        <p>
          Cookies are small text files stored on your device. We and our ad
          partners use them to remember preferences, measure performance, and
          serve relevant ads. You can disable cookies in your browser
          settings.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          Children&apos;s privacy
        </h2>
        <p>
          {SITE_NAME} does not knowingly collect personal information from
          children under 13. If you believe a child has provided us with
          personal data, please contact us so we can remove it.
        </p>

        <h2 className="mt-6 text-2xl font-semibold text-white">Contact</h2>
        <p>
          For privacy questions email{" "}
          <a
            className="text-brand-400 underline"
            href="mailto:privacy@example.com"
          >
            privacy@example.com
          </a>
          .
        </p>
      </article>
      <Footer />
    </main>
  );
}
