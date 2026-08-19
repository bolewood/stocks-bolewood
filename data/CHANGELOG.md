# Data changelog

Typed entries: **Data update** · **Correction** · **Methodology change** · **Schema change**.

## [1.0.0] - 2026-08-19

### Schema change
- Initial public schema (`schemaVersion` 1.0.0): discriminated union on `basis`; `holdingSecurity`, `wrapperType`, and `denominatorType` as separate fields; `sources[]` per field; `sourceClass` primary | secondary.

### Methodology change
- Initial methodology (`methodologyVersion` 1.0.0): FV-equivalent identity vs modeling convention; ARKVX denominator is NPORT-EX TNA; DXYZ OAI I PPUs excluded from IPO scaling; deploy `range` default.

### Data update
- Snapshot of 11 wrappers and Anthropic/OpenAI marks as used on stocks.bolewood.com v0.7.0.0 (2026-08-19).
