import CouponBanner from "./components/CouponBanner";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Stats from "./components/Stats";
import Partners from "./components/Partners";
import VideoDemo from "./components/VideoDemo";
import Plans from "./components/Plans";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import Rules from "./components/Rules";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main className="relative overflow-x-hidden">
      <CouponBanner />
      <Navbar />
      <Hero />
      <Stats />
      <Partners />
      <VideoDemo />
      <Plans />
      <HowItWorks />
      <Features />
      <Rules />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
