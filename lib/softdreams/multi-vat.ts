import { calculateProduct, VAT_RATES, type InvoiceInput } from "./invoice";

export type InvoiceProduct = InvoiceInput["products"][number];

export function roundInvoiceMoney(value: number, currency: string) {
  const digits = currency === "VND" ? 0 : 2;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function multiVatRate(product: InvoiceProduct) {
  return product.vat === -3 ? Number(product.vatRateOther || 0) : Math.max(0, product.vat);
}

export function recalculateMultiVatProduct(product: InvoiceProduct, currency: string, resetSpecialNegative = false): InvoiceProduct {
  const total = calculateProduct({ ...product, vatAmountOverride: "", amountOverride: "" }).total;
  const preserveEnteredTax = !resetSpecialNegative && (product.vat === -6 || product.vat === -7) && product.vatAmountOverride !== "";
  const vatAmount = preserveEnteredTax ? Number(product.vatAmountOverride) : roundInvoiceMoney(total * multiVatRate(product) / 100, currency);
  return { ...product, totalOverride: String(total), vatAmountOverride: String(vatAmount), amountOverride: String(roundInvoiceMoney(total + vatAmount, currency)) };
}

export function multiVatLineTotals(value: InvoiceInput) {
  return value.products.reduce((sum, product) => {
    if (product.feature === "2" || product.feature === "4") return sum;
    const amounts = calculateProduct(product);
    const sign = product.feature === "3" ? -1 : 1;
    return {
      total: sum.total + sign * Math.abs(amounts.total),
      vat: sum.vat + sign * Math.abs(amounts.vatAmount),
      amount: sum.amount + sign * Math.abs(amounts.amount),
    };
  }, { total: 0, vat: 0, amount: 0 });
}

export function syncMultiVatInvoice(value: InvoiceInput, products = value.products): InvoiceInput {
  const next = { ...value, products };
  const sums = multiVatLineTotals(next);
  return { ...next, totalOverride: String(sums.total), vatAmountOverride: String(sums.vat), amountOverride: String(sums.amount) };
}

const GROSS_LABELS = new Map<number, string>(VAT_RATES.map(([rate, label]) => [rate, label]));

export function multiVatGrossGroups(value: InvoiceInput) {
  return VAT_RATES.map(([rate]) => {
    const products = value.products.filter((product) => product.vat === rate && product.feature !== "2" && product.feature !== "4");
    const sums = products.reduce((sum, product) => {
      const amounts = calculateProduct(product);
      const sign = product.feature === "3" ? -1 : 1;
      return { total: sum.total + sign * Math.abs(amounts.total), vat: sum.vat + sign * Math.abs(amounts.vatAmount), amount: sum.amount + sign * Math.abs(amounts.amount) };
    }, { total: 0, vat: 0, amount: 0 });
    const otherRates = rate === -3 ? [...new Set(products.map((product) => product.vatRateOther).filter(Boolean))] : [];
    return { rate, label: GROSS_LABELS.get(rate) ?? String(rate), count: products.length, otherRates, ...sums };
  });
}

export function isFinancialLeaseInvoice(value: InvoiceInput) {
  return value.products.length > 0 && value.products.every((product) => product.vat === -5);
}
