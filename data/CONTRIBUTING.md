# Contributing to the dataset

The application is not the asset. Curated inputs live under `data/`. Production application code may not define wrapper-specific financial inputs; all wrapper records enter through `lib/loadAiData.mjs`.

## How to change a number

1. Edit the relevant file in `data/wrappers/` or `data/marks.json`.
2. Do not add a generic `value` field, and do not hand-write `impliedExposure` next to the inputs. The loader and `reference/derive.mjs` compute it.
3. Every material field needs `sources[]` with `fields`, `sourceClass` (`primary` or `secondary`), and preferably filing type, accession, issuer, document date, then URL.
4. `disclosed`, `pro-forma`, `historical`, `filed-fv-equiv`, `carrying-value-equiv`, and `round-implied` require at least one **primary** source. Secondary-only is allowed for `estimate`, and for `commitment` when no primary announcement exists.
5. Add a typed entry to `data/CHANGELOG.md`: **Data update**, **Correction**, **Methodology change**, or **Schema change**.
6. Run `npm test` and `npm run reference`. If the golden table should change, regenerate `reference/expected-results.json` from `reference/calculate.mjs` after reviewing the diff.
7. Bump `schemaVersion` only for schema changes; bump `methodologyVersion` only when the formula or convention changes. A new 10-Q is a data update, not a methodology change.

## What not to commit

Live Yahoo quotes, fallback prices, and other market prints. Those stay runtime / `reference/fixtures.json` (fixtures are a frozen scenario, not the public dataset).
