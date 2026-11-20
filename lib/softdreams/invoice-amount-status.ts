import { calculateInvoice, type InvoiceInput } from "./invoice";

export function invoiceAmountStatus(value: InvoiceInput) {
  const totals = calculateInvoice(value);
  const sum = totals.total + totals.vat;
  const expected = Number.isFinite(sum) ? Number(sum.toFixed(8)) : undefined;
  const raw = value.amountOverride.trim();
  if (!raw) return { state: "missing" as const, expected };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(Number(raw)) || expected === undefined) return { state: "invalid" as const, expected };
  const actual = Number(raw);
  return { state: Math.abs(actual - expected) <= 0.01 + Number.EPSILON ? "ready" as const : "mismatch" as const, expected, actual };
}
