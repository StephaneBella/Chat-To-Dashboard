import type { FieldFormat } from "../contract";

const DEFAULT_LOCALE = "fr-FR";
const NBSP = "\u00A0";

/**
 * The API returns rates with 2 decimals (12.47) and amounts with cents
 * (2297200.86): the display keeps that precision so no information is lost.
 * `maximumFractionDigits` is a maximum, not a fixed count, so 20.4 still
 * renders as "20,4" and not "20,40".
 */
const PERCENT_DIGITS = 2;
const CURRENCY_DIGITS = 2;

export function formatValue(
  value: unknown,
  format: FieldFormat = "number",
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");

  switch (format) {
    case "currency":
      return `${new Intl.NumberFormat(DEFAULT_LOCALE, {
        maximumFractionDigits: CURRENCY_DIGITS,
      }).format(n)}${NBSP}$`;
    case "percent":
      return `${new Intl.NumberFormat(DEFAULT_LOCALE, {
        maximumFractionDigits: PERCENT_DIGITS,
      }).format(n)}${NBSP}%`;
    case "compact":
      return new Intl.NumberFormat(DEFAULT_LOCALE, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
    case "number":
    default:
      return new Intl.NumberFormat(DEFAULT_LOCALE).format(n);
  }
}

export function formatFromUnit(unit: string | undefined): FieldFormat {
  if (unit === "%") return "percent";
  if (unit === "$") return "currency";
  return "number";
}
