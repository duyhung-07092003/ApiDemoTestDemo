import { calculateInvoice, calculateProduct, type InvoiceInput } from "@/lib/softdreams/invoice";

export function InvoiceDocumentPreview({ value, index }: { value: InvoiceInput; index: number }) {
  const totals = calculateInvoice(value);
  const money = (amount: number) => Number.isFinite(amount) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(amount) : "—";
  return <article className="invoice-document-preview">
    <div className="document-draft">BẢN NHÁP · CHƯA KÝ SỐ · CHƯA CÓ SỐ HÓA ĐƠN</div>
    <h3>{value.profile === "receipt" ? "BIÊN LAI" : value.pattern.startsWith("2") ? "HÓA ĐƠN BÁN HÀNG" : "HÓA ĐƠN GIÁ TRỊ GIA TĂNG"}</h3>
    <p>Hóa đơn {index + 1} · Ngày {value.date ? value.date.split("-").reverse().join("/") : "hiện tại do API xác định"}</p>
    <dl><dt>Ký hiệu</dt><dd>{value.pattern || "API tự chọn dải"} {value.serial}</dd><dt>Đơn vị mua</dt><dd>{value.customer || "—"}</dd><dt>Người mua</dt><dd>{value.buyer || "—"}</dd><dt>Mã số thuế</dt><dd>{value.tax || "—"}</dd><dt>Địa chỉ</dt><dd>{value.address || "—"}</dd><dt>Thanh toán</dt><dd>{value.payment || "—"}</dd></dl>
    <div className="invoice-document-table"><table><thead><tr><th>STT</th><th>Tên hàng hóa, dịch vụ</th><th>Trước thuế</th><th>Tiền thuế</th><th>Thanh toán</th></tr></thead><tbody>{value.products.map((row, i) => { const amounts = calculateProduct(row); const signed = (amount: number) => row.feature === "3" ? -Math.abs(amount) : amount; return <tr key={i}><td>{i + 1}</td><td>{row.name || "—"}</td><td>{money(signed(amounts.total))}</td><td>{money(signed(amounts.vatAmount))}</td><td>{money(signed(amounts.amount))}</td></tr>; })}</tbody></table></div>
    <dl className="document-totals"><dt>Tổng trước thuế</dt><dd>{money(totals.total)}</dd><dt>Tiền thuế GTGT</dt><dd>{money(totals.vat)}</dd><dt>Tổng thanh toán ({value.currency})</dt><dd><strong>{money(totals.amount)}</strong></dd></dl><p><strong>Số tiền bằng chữ:</strong> {value.amountInWords || "—"}</p>
    <small>Minh họa từ dữ liệu nhập; bố cục hóa đơn thật phụ thuộc mẫu đăng ký trên Softdreams.</small>
  </article>;
}
