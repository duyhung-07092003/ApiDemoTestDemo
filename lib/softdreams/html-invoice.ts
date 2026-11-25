import { calculateInvoice, calculateProduct, createEmptyInvoice, initialInvoice, type InvoiceInput } from "./invoice";
import { invoiceAmountStatus } from "./invoice-amount-status";
import { isFinancialLeaseInvoice } from "./multi-vat";

// Only fields exposed by the importInvoice form are forwarded.
const fields = ["pattern", "serial", "ikey", "payment", "customer", "buyer", "tax", "address", "date", "currency", "exchangeRate", "vatRate", "vatRateOther", "amountInWords", "listAttachNum", "listAttachDate", "identification", "phone", "provinceCode", "provinceName", "communeCode", "communeName", "locationCode", "locationName", "locationAddress"] as const;
export type InvoiceVatMode = "single" | "multi";
export function htmlFormIssues(value: InvoiceInput, mode: InvoiceVatMode = "single") {
  const issues: Array<{ field: string; message: string }> = [];
  const amount = invoiceAmountStatus(value);
  if (amount.state === "missing") issues.push({ field: "amountOverride", message: "Amount tổng tiền chưa được tính hoặc chưa nhập. Bấm Tính lại Amount hoặc nhập tổng tiền thanh toán trước khi gửi." });
  if (amount.state === "mismatch") issues.push({ field: "amountOverride", message: `Amount tổng tiền chưa khớp Total + VATAmount (đang nhập ${amount.actual}; đối chiếu ${amount.expected}). Kiểm tra và tính lại tổng tiền.` });
  if (mode === "multi" && value.pattern.trim() && !value.pattern.trim().startsWith("1")) issues.push({ field: "pattern", message: "Mẫu nhiều thuế TT78 cần Pattern bắt đầu bằng 1." });
  if (value.specialInvoice === "1") value.products.forEach((product, index) => {
    if (product.feature !== "5") return;
    try {
      const extra = JSON.parse(product.extra);
      if (extra && typeof extra === "object" && !Array.isArray(extra) && !["LTSan", "TTTSan", "XXu"].some((key) => Object.hasOwn(extra, key))) issues.push({ field: `products[${index}].extra`, message: "Mẫu HTML mua bán xe yêu cầu LTSan, TTTSan và XXu. Nhập các trường có dấu * trong Extra." });
    } catch { /* The shared validator reports malformed or missing Extra. */ }
  });
  return issues;
}
export function toHtmlVatInvoice(value: InvoiceInput, mode: InvoiceVatMode = "single"): InvoiceInput {
  const result = createEmptyInvoice();
  for (const key of fields) Reflect.set(result, key, value[key]);
  const totals = calculateInvoice(value);
  result.profile = "tt78";
  result.convert = 0;
  result.specialInvoice = value.specialInvoice;
  if (mode === "multi" && isFinancialLeaseInvoice(value)) result.vatRate = -5;
  result.totalOverride = String(totals.total);
  result.vatAmountOverride = String(totals.vat);
  result.amountOverride = String(totals.amount);
  result.products = value.products.map((product) => {
    const amounts = calculateProduct(product);
    return { ...initialInvoice.products[0], code: "", unit: "", quantity: 0, price: 0, discount: 0, discountAmount: 0,
      name: product.name, feature: product.feature, vat: mode === "single" ? value.vatRate : product.vat, vatRateOther: mode === "single" ? value.vatRateOther : product.vatRateOther,
      totalOverride: String(amounts.total), vatAmountOverride: String(amounts.vatAmount), amountOverride: String(amounts.amount),
      extra: product.feature === "5" && value.specialInvoice !== "0" ? product.extra : "",
    };
  });
  return result;
}

export function toHtmlSingleVatInvoice(value: InvoiceInput): InvoiceInput {
  return toHtmlVatInvoice(value, "single");
}

export function buildHtmlInvoiceBatch(invoices: InvoiceInput[], modes: InvoiceVatMode[] = []) {
  // Quotes are valid in XML text nodes. Escaping only XML markup characters keeps
  // JSON stored in <Extra> readable while remaining safe XML.
  const escape = (value: string | number) => String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
  const compactJson = (value: string) => {
    try { return JSON.stringify(JSON.parse(value)); } catch { return value; }
  };
  const tag = (name: string, value: string | number, depth = 3) => `${"  ".repeat(depth)}<${name}>${escape(value)}</${name}>`;
  const optional = (name: string, value: string | number) => String(value).trim() ? [tag(name, value)] : [];
  return ["<Invoices>", ...invoices.map((invoice, invoiceIndex) => {
    const mode = modes[invoiceIndex] ?? "single";
    const value = toHtmlVatInvoice(invoice, mode);
    return [
    "  <Inv>", "    <Invoice>", tag("Ikey", value.ikey),
    ...optional("CusName", value.customer), ...optional("Buyer", value.buyer), ...optional("CusTaxCode", value.tax.replace(/\s/g, "")), ...optional("CusAddress", value.address),
    ...optional("CusIdentification", value.identification), ...optional("CusPhone", value.phone),
    ...optional("ProvinceCode", value.provinceCode), ...optional("ProvinceName", value.provinceName), ...optional("CommuneCode", value.communeCode), ...optional("CommuneName", value.communeName),
    tag("PaymentMethod", value.payment), ...optional("ArisingDate", value.date.split("-").reverse().join("/")), tag("CurrencyUnit", value.currency), ...optional("ExchangeRate", value.exchangeRate),
    "      <Products>", ...value.products.map((product, index) => [
      "        <Product>", tag("No", index + 1, 5), ...(product.feature ? [tag("Feature", product.feature, 5)] : []), tag("ProdName", product.name, 5),
      tag("Total", product.totalOverride, 5), ...(mode === "multi" ? [tag("VATRate", product.vat, 5), ...(product.vat === -3 ? [tag("VATRateOther", product.vatRateOther, 5)] : [])] : []), tag("VATAmount", product.vatAmountOverride, 5), tag("Amount", product.amountOverride, 5),
      ...(product.extra ? [tag("Extra", compactJson(product.extra), 5)] : []), "        </Product>",
    ].join("\n")), "      </Products>",
    tag("Total", value.totalOverride), tag("VATAmount", value.vatAmountOverride), ...(mode === "single" || isFinancialLeaseInvoice(value) ? [tag("VATRate", mode === "multi" ? -5 : value.vatRate), ...(mode === "single" && value.vatRate === -3 ? [tag("VATRateOther", value.vatRateOther)] : [])] : []), tag("Amount", value.amountOverride), tag("AmountInWords", value.amountInWords),
    ...optional("ListAttachNum", value.listAttachNum), ...optional("ListAttachDate", value.listAttachDate.split("-").reverse().join("/")),
    ...optional("LocationCode", value.locationCode), ...optional("LocationName", value.locationName), ...optional("LocationAddress", value.locationAddress),
    "    </Invoice>", "  </Inv>",
  ].join("\n"); }), "</Invoices>"].join("\n");
}
