import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DISCLOSURE_MARKERS,
  extractReadmeDisclosureSection,
  renderReadmeDisclosureSection,
} from "../lib/disclosure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(
  readFileSync(join(root, "data", "disclosure.json"), "utf8")
);
const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const section = renderReadmeDisclosureSection(data);
const existing = extractReadmeDisclosureSection(readme);

let next;
if (existing) {
  next = readme.replace(existing, section);
} else {
  const insertAt = readme.indexOf("\n");
  next =
    insertAt >= 0
      ? `${readme.slice(0, insertAt + 1)}\n${section}\n${readme.slice(insertAt + 1)}`
      : `${section}\n${readme}`;
}

if (!next.includes(DISCLOSURE_MARKERS.begin) || !next.includes(DISCLOSURE_MARKERS.end)) {
  throw new Error("Failed to write generated disclosure markers into README.md");
}

writeFileSync(readmePath, next);
console.log("Updated README.md disclosure section from data/disclosure.json");
