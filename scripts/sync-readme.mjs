import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DISCLOSURE_MARKERS,
  WORKED_EXAMPLE_MARKERS,
  replaceMarkedSection,
  renderReadmeDisclosureSection,
} from "../lib/disclosure.mjs";
import { renderWorkedExampleMarkdown } from "../reference/workedExample.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(
  readFileSync(join(root, "data", "disclosure.json"), "utf8")
);
const readmePath = join(root, "README.md");
let readme = readFileSync(readmePath, "utf8");

readme = replaceMarkedSection(
  readme,
  WORKED_EXAMPLE_MARKERS,
  renderWorkedExampleMarkdown()
);
readme = replaceMarkedSection(
  readme,
  DISCLOSURE_MARKERS,
  renderReadmeDisclosureSection(data)
);

writeFileSync(readmePath, readme);
console.log("Updated README.md generated sections from data/");
