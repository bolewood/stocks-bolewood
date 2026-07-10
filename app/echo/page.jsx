import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ECHOSOTPFinder from "@/components/ECHOSOTPFinder";

export const metadata = {
  title: "ECHO SOTP Finder",
  description:
    "Sum-of-the-parts and SpaceX proxy calculator for EchoStar (NASDAQ: ECHO, formerly SATS). Visualize the SpaceX re-rate upside against corporate tax liabilities and the DISH DBS Chapter 11 restructuring.",
  openGraph: {
    title: "ECHO SOTP Finder",
    description:
      "Sum-of-the-parts and SpaceX proxy calculator for EchoStar (NASDAQ: ECHO, formerly SATS).",
    images: ["/og-default.png"],
    url: "https://stocks.bolewood.com/echo",
  },
  twitter: {
    card: "summary_large_image",
    title: "ECHO SOTP Finder",
    images: ["/og-default.png"],
  },
};

export default function ECHOPage() {
  return (
    <>
      <Header />
      <ECHOSOTPFinder />
      <Footer />
    </>
  );
}
