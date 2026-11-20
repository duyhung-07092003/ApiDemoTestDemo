import type { InvoiceInput } from "./invoice";

export function applyInvoiceRange(invoice: InvoiceInput, specialInvoice: string): InvoiceInput {
  const changed = invoice.specialInvoice !== specialInvoice;
  return { ...invoice, specialInvoice, products: invoice.products.map((product) => ({
    ...product,
    feature: specialInvoice !== "0" ? "5" : product.feature === "5" ? "1" : product.feature,
    extra: changed ? "" : product.extra,
  })) };
}
