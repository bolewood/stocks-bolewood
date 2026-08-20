# Data changelog

Typed entries: **Data update** · **Correction** · **Methodology change** · **Schema change**.

## [1.0.0] - 2026-08-19

### Schema change
- Initial public schema (`schemaVersion` 1.0.0): discriminated union on `basis`; `holdingSecurity`, `wrapperType`, and `denominatorType` as separate fields; `sources[]` per field; `sourceClass` primary | secondary.

### Methodology change
- Initial methodology (`methodologyVersion` 1.0.0): FV-equivalent identity vs modeling convention; ARKVX denominator is NPORT-EX TNA; DXYZ OAI I PPUs excluded from IPO scaling; deploy `range` default.
- 2026-08-20: Pre-v0.3 planning documents (`docs/ai-per-dollar-plan.md`) contain superseded figures. They were removed from the published tree in application v0.7.1.0 and are retained in git history for provenance. Cite the dated tag `data-2026-08-19`, not those documents.

### Data update
- Snapshot of 11 wrappers and Anthropic/OpenAI marks as used on stocks.bolewood.com v0.7.0.0 (2026-08-19).
