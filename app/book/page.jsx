import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivateBook from "@/components/PrivateBook";
import { loadBookSnapshots, loadCompanies, loadSecondaryTrends } from "@/lib/loadBooks.mjs";
import { disclosureSentence } from "@/lib/disclosure.mjs";
import disclosure from "@/data/disclosure.json";

const DESCRIPTION =
  "Reported portfolio weights and fair values per $100 across pre-IPO funds including Destiny Tech100 (DXYZ), Fundrise Innovation Fund (VCX), ARK Venture Fund (ARKVX), Robinhood Ventures (RVI), and other private-market vehicles.";

export const metadata = {
  title: "Private Book",
  description: DESCRIPTION,
  openGraph: {
    title: "Private Book | stocks.bolewood.com",
    description: DESCRIPTION,
    url: "https://stocks.bolewood.com/book",
  },
};

export default function BookPage() {
  const companies = loadCompanies();
  const snapshots = loadBookSnapshots(companies);
  const secondaryTrends = loadSecondaryTrends();
  return (
    <>
      <Header />
      <PrivateBook
        companyMap={companies.companies}
        snapshots={snapshots}
        secondaryTrends={secondaryTrends}
        disclosure={disclosureSentence(disclosure)}
      />
      <Footer />
    </>
  );
}
