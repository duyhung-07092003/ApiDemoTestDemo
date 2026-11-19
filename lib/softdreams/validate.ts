import { initialInvoice, calculateInvoice, calculateProduct, VAT_RATES, type InvoiceInput } from "./invoice";
import { specialProductIssues } from "./special-rules";

export type InvoiceIssue = { field: string; message: string };
export const INVOICE_LIMITS: Partial<Record<keyof InvoiceInput, number>> = {
  customer: 400, buyer: 100, customerCode: 50, address: 400, phone: 20, bankName: 400,
  bankNo: 30, customerEmails: 255, passportNo: 20, provinceCode: 2, provinceName: 50,
  communeCode: 5, communeName: 50, payment: 50, currency: 3, amountInWords: 255,
  locationCode: 5, locationName: 400, locationAddress: 400, storeCode: 50, storeName: 400, comAddress: 400,
};
export function invoiceIssues(data: InvoiceInput): InvoiceIssue[] {
  const issues: InvoiceIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  const required = (key: keyof InvoiceInput, label: string) => { if (!String(data[key]).trim()) add(key, label + " không được để trống."); };
  const receipt = data.profile === "receipt";
  if (!["tt78", "receipt"].includes(data.profile)) add("profile", "Form hiện hỗ trợ TT78 và biên lai; mẫu cũ/TNCN cần cấu trúc riêng.");
  if (/^(C45-BB|C06-BB|EBL|BLP|CTT50)/i.test(data.pattern.trim()) && !receipt) add("profile", "Pattern biên lai: chọn bộ quy tắc Receipt.");
  if (!["0", "1", "2", "3"].includes(data.specialInvoice)) add("specialInvoice", "Chọn loại dải đặc trưng hợp lệ.");
  if (![0, 1].includes(data.convert)) add("convert", "Convert chỉ nhận 0 hoặc 1.");
  required("ikey", "Ikey"); required("payment", "PaymentMethod");
  if (!receipt) {
    required("currency", "CurrencyUnit"); required("amountInWords", "AmountInWords");
    if (!data.buyer.trim() && !data.customer.trim()) add("customer", "Buyer và CusName không được đồng thời trống.");
  }
  for (const [key, max] of Object.entries(INVOICE_LIMITS)) if (String(data[key as keyof InvoiceInput]).length > max!) add(key, "Tối đa " + max + " ký tự.");
  if (data.fkey && !/^[a-zA-Z0-9.\-_]*$/.test(data.fkey)) add("fkey", "Fkey chỉ gồm chữ ASCII, số, dấu chấm, gạch ngang, gạch dưới.");
  if (data.tax && !/^(?:\d{10}|\d{10}-\d{3}|\d{12})$/.test(data.tax)) add("tax", "CusTaxCode cần 10 số, 10 số-3 số hoặc 12 số.");
  if (!receipt && data.tax) { required("customer", "CusName khi có MST"); required("address", "CusAddress khi có MST"); }
  if (data.identification && !/^(?:\d{9}|\d{12})$/.test(data.identification)) add("identification", "CusIdentification gồm đúng 9 hoặc 12 chữ số.");
  let extra: Record<string, unknown> = {};
  try { extra = JSON.parse(data.extra) || {}; } catch { /* Extra thường cho phép văn bản. */ }
  const budget = data.budgetaryRelationshipCode || String(extra.MDVQHNSach ?? "");
  const passport = data.passportNo || String(extra.PassportNo ?? "");
  if (budget && !/^[1-9][a-zA-Z0-9]{6}$/.test(budget)) add("budgetaryRelationshipCode", "Mã ngân sách gồm 7 ký tự, bắt đầu bằng số 1–9.");
  if (passport.length > 20) add("passportNo", "PassportNo tối đa 20 ký tự, kể cả lấy từ Extra.");
  for (const key of ["date", "listAttachDate"] as const) {
    const date = data[key];
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) add(key, "Ngày không hợp lệ.");
  }
  const pattern = data.pattern.trim().toUpperCase();
  const isMtt = pattern[4] === "M";
  if (/^[1-5][A-Z]\d{2}/.test(pattern)) {
    const year = data.date ? data.date.slice(2, 4) : String(new Date().getFullYear()).slice(2);
    if (year !== pattern.slice(2, 4)) add("date", "Năm ArisingDate phải trùng năm trên Pattern; ngày trống dùng năm hiện tại.");
  }
  if (isMtt && data.taxAuthorityCode) {
    const code = data.taxAuthorityCode.trim();
    const match = code.match(/^M([1-5])-(\d{2})-(.+)-(\d{11})$/);
    if (code.length !== 23) add("taxAuthorityCode", "TaxAuthorityCode của hóa đơn MTT phải đủ 23 ký tự.");
    else if (!match || match[1] !== pattern[0] || match[2] !== pattern.slice(2, 4)) {
      add("taxAuthorityCode", "TaxAuthorityCode phải khớp loại hóa đơn và năm trên Pattern; 11 ký tự cuối phải là số.");
    }
  }
  const numeric = (value: string, field: string) => {
    if (value !== "" && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)))) add(field, "Cần số hợp lệ, dùng dấu chấm thập phân.");
  };
  for (const key of ["totalOverride", "vatAmountOverride", "amountOverride", "exchangeRate", "discount", "taxFreeDeductions"] as const) numeric(data[key], key);
  const vat = (rate: number, other: string, field: string) => {
    if (!VAT_RATES.some(([value]) => value === rate)) add(field, "Mã thuế suất không hợp lệ.");
    const otherFormat = isMtt ? /^(?:\d{1,2}(?:\.\d{0,2})?|\.\d{1,2})$/ : /^\d{1,2}(?:\.\d{1,2})?$/;
    if (rate === -3 && (!otherFormat.test(other) || Number(other) > 99.99)) add(field + "Other", isMtt
      ? "VATRateOther MTT bắt buộc từ 0–99.99, tối đa 2 số thập phân (có thể nhập dạng .5)."
      : "VATRateOther bắt buộc từ 0–99.99, tối đa 2 số thập phân.");
  };
  vat(data.vatRate, data.vatRateOther, "vatRate");
  if (data.includeGross) add("includeGross", "Không gửi bộ Gross; để Softdreams tự tính từ dòng.");
  if (receipt) {
    if (data.vatRate !== -1) add("vatRate", "Biên lai cần thuế -1 (KCT).");
    if (data.currency && data.currency !== "VND") add("currency", "Biên lai chỉ dùng VND.");
    if (calculateInvoice(data).vat !== 0) add("vatAmountOverride", "Biên lai cần VATAmount = 0.");
    if (calculateInvoice(data).total < 0) add("totalOverride", "Total biên lai không được âm.");
    if (data.specialInvoice !== "0") add("specialInvoice", "Biên lai không dùng hàng hóa đặc trưng.");
  }
  if (data.specialInvoice === "1") {
    for (const [key, label] of [["customer", "CusName"], ["tax", "CusTaxCode"], ["address", "CusAddress"], ["phone", "CusPhone"], ["provinceCode", "ProvinceCode"], ["provinceName", "ProvinceName"], ["communeCode", "CommuneCode"], ["communeName", "CommuneName"]] as const) required(key, label + " khi bán xe");
  }
  if (!data.products.length) add("products", "Cần ít nhất một dòng sản phẩm.");
  let goods = 0, discounts = 0, hasDiscount = false;
  data.products.forEach((p, index) => {
    const path = "products[" + index + "]";
    const field = (key: string, message: string) => add(path + "." + key, "Dòng " + (index + 1) + ": " + message);
    if (!p.name.trim()) field("name", "ProdName không được trống.");
    for (const [key, max] of [["name", 500], ["code", 50], ["unit", 50]] as const) if (p[key].length > max) field(key, "Tối đa " + max + " ký tự.");
    if (!["", "1", "2", "3", "4", "5"].includes(p.feature)) field("feature", "Feature cần 1–5 hoặc bỏ trống.");
    if (p.discount > 100) field("discount", "Discount không được vượt 100%.");
    vat(p.vat, p.vatRateOther, path + ".vatRate");
    for (const key of ["totalOverride", "vatAmountOverride", "amountOverride"] as const) numeric(p[key], path + "." + key);
    const totals = calculateProduct(p);
    if (!Object.values(totals).every(Number.isFinite)) field("amountOverride", "Kết quả tiền không hợp lệ.");
    if ((p.vat === -5) !== (data.vatRate === -5)) field("vat", "CTTC: hóa đơn và tất cả dòng phải cùng -5.");
    if (receipt && !["", "1", "4"].includes(p.feature)) field("feature", "Biên lai chỉ cho Feature trống, 1 hoặc 4.");
    if (receipt && (p.vat !== -1 || totals.vatAmount !== 0 || totals.total < 0)) field("vat", "Biên lai cần thuế -1, VATAmount = 0 và Total ≥ 0.");
    const feature = p.feature || (totals.amount < 0 ? "3" : totals.amount === 0 ? "4" : "1");
    if (feature === "3") { hasDiscount = true; discounts += Math.abs(totals.amount); }
    if (["1", "5"].includes(feature)) { if (totals.amount < 0) discounts += Math.abs(totals.amount); else goods += totals.amount; }
    specialProductIssues(data.specialInvoice, feature, p.extra).forEach((message) => field("extra", message));
  });
  if (hasDiscount && (goods === 0 || discounts > goods)) add("products", "Chiết khấu vượt tiền hàng hoặc không có hàng hóa; kiểm tra lại (trừ mẫu được cấu hình miễn kiểm tra).");
  if (!Object.values(calculateInvoice(data)).every(Number.isFinite)) add("amountOverride", "Tổng tiền vượt miền số hợp lệ.");
  if (!hasDiscount && discounts > goods && (!data.listAttachNum || !data.listAttachDate)) add("listAttachNum", "Tiền âm vượt tiền hàng: cần cả số và ngày bảng kê.");
  data.fees.forEach((fee, i) => {
    const path = "fees[" + i + "]";
    if (!fee.name.trim() || fee.name.length > 100) add(path + ".name", "Tên phí bắt buộc, tối đa 100 ký tự.");
    if (!fee.amount) add(path + ".amount", "Amount phí bắt buộc.");
    for (const key of ["amount", "feeRate", "vatRate", "vatRateOther", "vatAmount", "totalCharge"] as const) numeric(fee[key], path + "." + key);
  });
  return issues;
}

export function validateInvoice(value: unknown): InvoiceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dữ liệu hóa đơn không hợp lệ.");
  const input = value as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  const validateTypes = (row: Record<string, unknown>, defaults: Record<string, unknown>, label: string) => {
    for (const [key, fallback] of Object.entries(defaults)) {
      if (Array.isArray(fallback)) continue;
      if (typeof row[key] !== typeof fallback || (typeof row[key] === "number" && !Number.isFinite(row[key]))) throw new Error("Trường không hợp lệ: " + label + key);
      if (typeof row[key] === "string" && /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(row[key])) throw new Error("Ký tự XML không hợp lệ: " + label + key);
    }
  };
  validateTypes(input, initialInvoice, "");
  for (const key of Object.keys(initialInvoice)) clean[key] = input[key];
  if (!Array.isArray(input.products) || input.products.length > 9999) throw new Error("Danh sách sản phẩm không hợp lệ hoặc vượt 9999 dòng.");
  clean.products = input.products.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Sản phẩm không hợp lệ.");
    validateTypes(row as Record<string, unknown>, initialInvoice.products[0], "Product/");
    return { ...row };
  });
  if (!Array.isArray(input.fees) || input.fees.length > 1000) throw new Error("Danh sách phí không hợp lệ.");
  clean.fees = input.fees.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Phí không hợp lệ.");
    validateTypes(row as Record<string, unknown>, { name: "", amount: "", feeRate: "", vatRate: "", vatRateOther: "", vatAmount: "", totalCharge: "" }, "InvoiceFee/");
    return { ...row };
  });
  const data = clean as InvoiceInput;
  data.pattern = data.pattern.trim().toUpperCase();
  data.tax = data.tax.replace(/\s/g, "");
  data.customerCode = data.customerCode.replace(/\s/g, "");
  const issues = invoiceIssues(data);
  if (issues.length) throw new Error(issues.map((issue) => issue.field + ": " + issue.message).join("\n"));
  return data;
}
