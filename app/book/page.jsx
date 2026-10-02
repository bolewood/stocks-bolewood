import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivateBook from "@/components/PrivateBook";
import { loadBookSnapshots, loadCompanies } from "@/lib/loadBooks.mjs";
import { disclosureSentence } from "@/lib/disclosure.mjs";
import disclosure from "@/data/disclosure.json";

const DESCRIPTION =
  "Reported portfolio weights for Destiny Tech100 and the Fundrise Innovation Fund, and the reported fair value of each company per $100 of the fund's market price.";

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
  return (
    <>
      <Header />
      <PrivateBook
        companyMap={companies.companies}
        snapshots={snapshots}
        disclosure={disclosureSentence(disclosure)}
      />
      <Footer />
    </>
  );
}
