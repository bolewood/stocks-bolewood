import BOTNAVFinder from "@/components/BOTNAVFinder";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "BOT NAV Finder | RoboStrategy Real-Time NAV Calculator",
  description: "Interactive calculator for RoboStrategy (NASDAQ: BOT). Estimate real-time Net Asset Value by marking underlying private robotics and AI holdings to current market prices.",
};

export default function BOTPage() {
  return (
    <>
      <Header />
      <BOTNAVFinder />
      <Footer />
    </>
  );
}
