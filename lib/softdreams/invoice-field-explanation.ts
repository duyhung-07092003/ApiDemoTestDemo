import { calculateInvoice, calculateProduct, type InvoiceInput } from "./invoice";
import type { XmlSelection } from "./xml-selection";

const invoiceKeys: Record<string, keyof InvoiceInput> = {
  Ikey: "ikey", Fkey: "fkey", PaymentMethod: "payment", CusCode: "customerCode", Buyer: "buyer", CusName: "customer", CusTaxCode: "tax", CusAddress: "address", CusPhone: "phone", Email: "email", CusEmails: "customerEmails", EmailCC: "emailCC", CusIdentification: "identification", PassportNo: "passportNo", CusBankName: "bankName", CusBankNo: "bankNo", ArisingDate: "date", ListAttachNum: "listAttachNum", ListAttachDate: "listAttachDate", CurrencyUnit: "currency", ExchangeRate: "exchangeRate", VATRate: "vatRate", VATRateOther: "vatRateOther", AmountInWords: "amountInWords", Discount: "discount", DiscountAmount: "discountAmount", Extra: "extra", LocationCode: "locationCode", LocationName: "locationName", LocationAddress: "locationAddress", StoreCode: "storeCode", StoreName: "storeName", ProvinceCode: "provinceCode", ProvinceName: "provinceName", CommuneCode: "communeCode", CommuneName: "communeName", BudgetaryRelationshipCode: "budgetaryRelationshipCode", ComAddress: "comAddress", Note: "note", ProfileCode: "profileCode", PayOrderOrgTaxCode: "payOrderOrgTaxCode", PayOrderOrgName: "payOrderOrgName", PayOrderOrgAddress: "payOrderOrgAddress", TaxFreeDeductions: "taxFreeDeductions", TaxAuthorityCode: "taxAuthorityCode",
};
const productKeys: Record<string, keyof InvoiceInput["products"][number]> = { Code: "code", ProdName: "name", ProdUnit: "unit", ProdQuantity: "quantity", ProdPrice: "price", Feature: "feature", VATRate: "vat", VATRateOther: "vatRateOther", Discount: "discount", DiscountAmount: "discountAmount", Extra: "extra" };
const feeKeys: Record<string, keyof InvoiceInput["fees"][number]> = { Name: "name", Amount: "amount", FeeRate: "feeRate", VATRate: "vatRate", VATRateOther: "vatRateOther", VATAmount: "vatAmount", TotalCharge: "totalCharge" };

export function invoiceFieldExplanation(value: InvoiceInput, selection: XmlSelection) {
  const totals = calculateInvoice(value);
  const product = selection.scope === "product" ? value.products[selection.index ?? -1] : undefined;
  const amounts = product ? calculateProduct(product) : null;
  const field = selection.tag;
  let actual: string | number | undefined;
  let expected: number | undefined;
  let formula = "Không có công thức, nhập trực tiếp.";
  let note = "Giải thích trên dữ liệu form; kết quả xử lý thật phụ thuộc quy tắc và cấu hình API.";
  if (product && amounts) {
    if (field === "Total") { actual = amounts.total; formula = "Total = thành tiền của dòng, chưa thuế"; note = "Nhập trực tiếp theo chứng từ. Mẫu HTML không có ô số lượng/đơn giá bắt buộc."; }
    else if (field === "VATAmount") { actual = amounts.vatAmount; expected = Math.round(amounts.total * (product.vat === -3 ? Number(product.vatRateOther) : Math.max(0, product.vat))) / 100; formula = "Gợi ý: VATAmount = Total × thuế suất ÷ 100"; note = "Form gửi rõ tiền thuế hiển thị. Nhánh tự tính tại API yêu cầu dòng kế thừa thuế suất, không gửi Feature và không gửi VATAmount."; }
    else if (field === "Amount") { actual = amounts.amount; expected = amounts.total + amounts.vatAmount; formula = "Gợi ý: Amount = Total + VATAmount của dòng"; }
    else if (field === "No") { actual = (selection.index ?? 0) + 1; formula = "Tự đánh số theo vị trí sản phẩm trong hóa đơn."; }
    else if (productKeys[field]) actual = product[productKeys[field]];
  } else if (selection.scope === "fee") {
    const fee = value.fees[selection.index ?? -1];
    const key = feeKeys[field];
    if (fee && key) actual = fee[key];
    note = "Phí/lệ phí là nhóm riêng trong InvoiceFees, không phải trường số tiền của dòng Product.";
  } else {
    if (field === "Total") { actual = totals.total; expected = totals.subtotal; formula = "Gợi ý: Total = tổng Total các dòng theo Feature"; }
    else if (field === "VATAmount") { actual = totals.vat; expected = totals.calculatedVat; formula = "Gợi ý: VATAmount = tổng tiền thuế các dòng theo Feature"; }
    else if (field === "Amount") { actual = totals.amount; expected = totals.total + totals.vat; formula = "Gợi ý: Amount = Total + VATAmount của hóa đơn"; }
    else if (invoiceKeys[field]) actual = value[invoiceKeys[field]] as string | number;
    if (["Total", "VATAmount", "Amount"].includes(field)) note = "Feature 2 và 4 không cộng vào tổng; Feature 3 tính âm. Giá trị nhập riêng được ưu tiên; chênh lệch là cảnh báo đối chiếu, không tự kết luận API từ chối.";
  }
  if (field === "AmountInWords") { formula = "AmountInWords = số tiền Amount đọc bằng chữ"; note = "API nhận chuỗi đã nhập; nút Điền theo Amount hỗ trợ số nguyên VND."; }
  if (field === "ArisingDate" || field === "ListAttachDate") { actual = typeof actual === "string" ? actual.split("-").reverse().join("/") : actual; note = field === "ArisingDate" ? "Ngày trống do API xác định. Năm cần khớp Pattern; XML dùng dd/MM/yyyy." : "XML gửi dd/MM/yyyy. Nhập cùng số bảng kê khi nghiệp vụ yêu cầu."; }
  if (field === "VATRate") note = "Mã thuế suất âm là mã nghiệp vụ. Thuế -3 cần VATRateOther; -5 cần đồng nhất giữa hóa đơn và các dòng.";
  return { field, where: selection.scope === "product" ? `Sản phẩm ${(selection.index ?? 0) + 1}` : selection.scope === "fee" ? `Phí/lệ phí ${(selection.index ?? 0) + 1}` : "Cấp hóa đơn", formula, actual: actual ?? "", expected, matches: expected !== undefined && typeof actual === "number" && Number.isFinite(actual) && Number.isFinite(expected) ? Math.abs(actual - expected) <= 0.01 : undefined, note };
}
