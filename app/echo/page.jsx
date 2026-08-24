import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ECHOSOTPFinder from "@/components/ECHOSOTPFinder";

export const metadata = {
  title: "ECHO SOTP Finder",
  description:
    "Sum-of-the-parts and SpaceX proxy calculator for EchoStar (NASDAQ: ECHO, formerly SATS). AT&T closed July 28, 2026; Hughes US is in Chapter 11; remaining swing is 261.8M SPCX shares delivered ~Nov 30, 2027.",
  openGraph: {
    title: "ECHO SOTP Finder",
    description:
      "EchoStar SOTP after the AT&T close and Hughes Chapter 11. Live SPCX marks a 261.8M share delivery ~Nov 30, 2027.",
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
