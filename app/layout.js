import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: {
    default: "stocks.bolewood.com",
    template: "%s | stocks.bolewood.com",
  },
  description:
    "Analytical tools for public market research by Anthony Showalter.",
  metadataBase: new URL("https://stocks.bolewood.com"),
  openGraph: {
    title: "stocks.bolewood.com",
    description:
      "Analytical tools for public market research by Anthony Showalter.",
    url: "https://stocks.bolewood.com",
    siteName: "stocks.bolewood.com",
    images: ["/og-default.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "stocks.bolewood.com",
    description:
      "Analytical tools for public market research by Anthony Showalter.",
    images: ["/og-default.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
