import { invoiceIssues } from "./validate";
import type { InvoiceInput } from "./invoice";

export type CompanySimulation = { notValidate: boolean; skipVat8: boolean; from: string; to: string };
const skippableFields = new Set(["customer", "buyer", "tax", "address", "phone", "bankName", "bankNo", "customerCode", "customerEmails", "passportNo", "identification", "budgetaryRelationshipCode", "payment", "currency", "amountInWords", "provinceCode", "provinceName", "communeCode", "communeName"]);
export function companyPreview(value: InvoiceInput, options: CompanySimulation) {
  const actual = invoiceIssues(value);
  const issues = actual.filter((issue) => !(options.notValidate && value.profile === "tt78" && (skippableFields.has(issue.field) || /^products\[\d+\]\.(?:name|code|unit)$/.test(issue.field))));
  const skipped = actual.length - issues.length;
  if (options.notValidate && value.products.length && value.products.every((row) => !row.name.trim())) issues.push({ field: "products", message: "Tất cả ProdName trống: nhánh NullProd vẫn có thể từ chối, dù bỏ qua kiểm tra trường." });
  const hasVat8 = value.vatRate === 8 || value.products.some((row) => row.vat === 8) || value.fees.some((fee) => Number(fee.vatRate) === 8 || Number(fee.feeRate) === 8);
  const eligible = /^[125]/.test(value.pattern.trim());
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  const configured = validDate(options.from) && validDate(options.to) && options.from <= options.to;
  const now = new Date();
  const date = value.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if ((options.from || options.to) && !configured) issues.push({ field: "simulation", message: "Khoảng ngày giả lập cần đủ hai ngày hợp lệ, ngày bắt đầu không sau ngày kết thúc." });
  if (hasVat8 && eligible && !options.skipVat8 && configured && (date < options.from || date > options.to)) issues.push({ field: "date", message: "Thuế 8% nằm ngoài khoảng ngày CheckVat8 bạn nhập để giả lập." });
  return { issues, skipped, pendingVat8: hasVat8 && eligible && !options.skipVat8 && !configured };
}
