import { createEmptyInvoice } from "./invoice";
import { invoiceIssues } from "./validate";
import type { XmlIssue, XmlOptions } from "./validate-xml";

const tags = {
  ikey: "Ikey", fkey: "Fkey", payment: "PaymentMethod", customerCode: "CusCode", buyer: "Buyer", customer: "CusName", tax: "CusTaxCode", address: "CusAddress", phone: "CusPhone", email: "Email", bankName: "CusBankName", bankNo: "CusBankNo", customerEmails: "CusEmails", emailCC: "EmailCC", passportNo: "PassportNo", storeCode: "StoreCode", storeName: "StoreName", provinceCode: "ProvinceCode", provinceName: "ProvinceName", communeCode: "CommuneCode", communeName: "CommuneName", exchangeRate: "ExchangeRate", budgetaryRelationshipCode: "BudgetaryRelationshipCode", comAddress: "ComAddress", note: "Note", profileCode: "ProfileCode", payOrderOrgTaxCode: "PayOrderOrgTaxCode", payOrderOrgName: "PayOrderOrgName", payOrderOrgAddress: "PayOrderOrgAddress", taxAuthorityCode: "TaxAuthorityCode", discount: "Discount", taxFreeDeductions: "TaxFreeDeductions", vatRateOther: "VATRateOther", date: "ArisingDate", currency: "CurrencyUnit", vatRate: "VATRate", discountAmount: "DiscountAmount", amountInWords: "AmountInWords", extra: "Extra", identification: "CusIdentification", locationCode: "LocationCode", locationName: "LocationName", locationAddress: "LocationAddress", listAttachNum: "ListAttachNum", listAttachDate: "ListAttachDate", totalOverride: "Total", vatAmountOverride: "VATAmount", amountOverride: "Amount",
};
const productTags: Record<string, string> = { code: "Code", name: "ProdName", unit: "ProdUnit", feature: "Feature", quantity: "ProdQuantity", price: "ProdPrice", vat: "VATRate", vatRate: "VATRate", discountAmount: "DiscountAmount", extra: "Extra", vatRateOther: "VATRateOther", discount: "Discount", totalOverride: "Total", vatAmountOverride: "VATAmount", amountOverride: "Amount" };
const children = (node: Element, name: string) => Array.from(node.children).filter((child) => child.tagName === name);
const value = (node: Element, name: string) => children(node, name)[0]?.textContent?.trim() ?? "";

export function xmlFormIssues(invoice: Element, wrapper: Element, options: XmlOptions, path: string): XmlIssue[] {
  const data = createEmptyInvoice();
  for (const [key, tag] of Object.entries(tags)) {
    const raw = value(invoice, tag);
    Reflect.set(data, key, typeof data[key as keyof typeof data] === "number" ? (raw ? Number(raw) : key === "discountAmount" ? 0 : NaN) : raw);
  }
  data.ikey ||= value(wrapper, "key");
  data.profile = options.profile ?? "tt78";
  data.specialInvoice = options.specialInvoice ?? (options.specialGoods ? "1" : "0");
  data.pattern = options.pattern ?? "";
  data.serial = options.serial ?? "";
  for (const key of ["date", "listAttachDate"] as const) data[key] = data[key].replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1");
  const products = children(invoice, "Products")[0];
  data.products = (products ? children(products, "Product") : []).map((node) => {
    const row = { ...createEmptyInvoice().products[0] };
    for (const [key, tag] of Object.entries(productTags)) {
      if (key === "vatRate") continue;
      const raw = value(node, tag) || (key === "vat" ? value(invoice, "VATRate") : "");
      Reflect.set(row, key, typeof row[key as keyof typeof row] === "number" ? (raw ? Number(raw) : 0) : raw);
    }
    return row;
  });
  const fees = children(invoice, "InvoiceFees")[0];
  data.fees = (fees ? children(fees, "InvoiceFee") : []).map((node) => ({ name: value(node, "Name"), amount: value(node, "Amount"), feeRate: value(node, "FeeRate"), vatRate: value(node, "VATRate"), vatRateOther: value(node, "VATRateOther"), vatAmount: value(node, "VATAmount"), totalCharge: value(node, "TotalCharge") }));
  const hasInvoiceVatRate = value(invoice, "VATRate") !== "";
  return invoiceIssues(data).filter((issue) => !(options.vatMode === "multi" && !hasInvoiceVatRate && ["vatRate", "vatRateOther"].includes(issue.field))).map((issue) => {
    const product = /^products\[(\d+)\](?:\.(.+))?$/.exec(issue.field);
    const fee = /^fees\[(\d+)\]\.(.+)$/.exec(issue.field);
    const issuePath = product ? path + "/Products/Product[" + (Number(product[1]) + 1) + "]" + (product[2] ? "/" + (productTags[product[2]] ?? product[2]) : "")
      : fee ? path + "/InvoiceFees/InvoiceFee[" + (Number(fee[1]) + 1) + "]/" + (fee[2][0].toUpperCase() + fee[2].slice(1))
      : ["profile", "specialInvoice"].includes(issue.field) ? "/Context/" + issue.field : path + "/" + (tags[issue.field as keyof typeof tags] ?? issue.field);
    return { level: "error", path: issuePath, message: issue.message, suggestion: "Đối chiếu trường này với loại mẫu và dải hóa đơn đã chọn." };
  });
}
