import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBook, validateCompanies } from "../data/schema/validate.mjs";

const dataRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

function bookFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...bookFiles(path));
    else if (entry.name.endsWith(".json")) found.push(path);
  }
  return found.sort();
}

export function loadCompanies() {
  const companies = JSON.parse(readFileSync(join(dataRoot, "companies.json"), "utf8"));
  validateCompanies(companies);
  return companies;
}

export function loadBookSnapshots(companies = loadCompanies()) {
  return bookFiles(join(dataRoot, "books")).map((path) => {
    const book = JSON.parse(readFileSync(path, "utf8"));
    validateBook(book, { companies });
    return book;
  });
}
