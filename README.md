# stocks.bolewood.com

Analytical tools for public market research, live at [stocks.bolewood.com](https://stocks.bolewood.com).

<!-- BEGIN GENERATED DISCLOSURE -->
## Author positions

**Disclosure:** As of August 19, 2026, the author holds long positions in DXYZ, SKM, ZM, AMZN, GOOG and NVDA. The DXYZ exposure includes options. Positions are subject to change without notice.
<!-- END GENERATED DISCLOSURE -->

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Running Tests

```bash
npm test
```

Runs the unit tests (`test/*.test.mjs`) with Node's built-in test runner (`node --test`). No dev server needed.

To regenerate the README disclosure section from `data/disclosure.json`:

```bash
npm run sync:disclosure
```

## Data and reference calculator

Curated Anthropic/OpenAI wrapper inputs live under [`data/`](data/), licensed as described in [`data/LICENSE-DATA`](data/LICENSE-DATA). Application and reference code are MIT ([`LICENSE`](LICENSE)).

```bash
npm run reference
```

reproduces [`reference/expected-results.json`](reference/expected-results.json) from `data/` with no app code. See [`data/METHODOLOGY.md`](data/METHODOLOGY.md) and [`CITATION.cff`](CITATION.cff).

## Project Docs

- [CHANGELOG.md](CHANGELOG.md) — release history
- [TODOS.md](TODOS.md) — known deferred work

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
