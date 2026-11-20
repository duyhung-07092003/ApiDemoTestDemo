import { buildInvoiceEntry, type InvoiceInput } from "./invoice";
import { validateInvoice } from "./validate";

// Application limit; the provider's MaxBlockInv may differ by deployment.
export const MAX_INVOICES_PER_REQUEST = 50;
export const SHARED_INVOICE_FIELDS = ["pattern", "serial", "convert", "profile", "specialInvoice"] as const;

export function buildInvoiceBatch(invoices: InvoiceInput[]) {
  return ["<Invoices>", ...invoices.map(buildInvoiceEntry), "</Invoices>"].join("\n");
}

export function validateInvoiceBatch(value: unknown): InvoiceInput[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_INVOICES_PER_REQUEST) {
    throw new Error(`Mỗi gói cần từ 1 đến ${MAX_INVOICES_PER_REQUEST} hóa đơn.`);
  }
  const keys = new Set<string>();
  const invoices = value.map((row, index) => {
    let invoice: InvoiceInput;
    try { invoice = validateInvoice(row); }
    catch (error) { throw new Error(`Hóa đơn ${index + 1}: ${error instanceof Error ? error.message : "Dữ liệu không hợp lệ."}`); }
    const key = invoice.ikey.trim();
    if (keys.has(key)) throw new Error(`Hóa đơn ${index + 1}: Ikey bị trùng trong gói.`);
    keys.add(key);
    return invoice;
  });
  for (const [index, invoice] of invoices.entries()) {
    if (SHARED_INVOICE_FIELDS.some((key) => invoice[key] !== invoices[0][key])) {
      throw new Error(`Hóa đơn ${index + 1}: Pattern, Serial, Convert và loại mẫu phải thống nhất trong gói.`);
    }
  }
  return invoices;
}
