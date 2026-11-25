import { calculateInvoice, calculateProduct, type InvoiceInput } from "@/lib/softdreams/invoice";
import { multiVatGrossGroups } from "@/lib/softdreams/multi-vat";

export function InvoiceDocumentPreview({ value, index, mode = "single" }: { value: InvoiceInput; index: number; mode?: "single" | "multi" }) {
  const totals = calculateInvoice(value);
  const gross = multiVatGrossGroups(value);
  const money = (amount: number) => Number.isFinite(amount) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(amount) : "—";
  const vatLabel = (rate: number, other: string) => rate === -3 ? `KHÁC ${other || "?"}%` : rate < 0 ? ({ [-1]: "KCT", [-2]: "KKKNT", [-5]: "CTTC", [-6]: "KTPVDC", [-7]: "KTGTT" } as Record<number, string>)[rate] : `${rate}%`;
  return <article className="invoice-document-preview">
    <div className="document-draft">BẢN NHÁP · CHƯA KÝ SỐ · CHƯA CÓ SỐ HÓA ĐƠN</div>
    <h3>{value.profile === "receipt" ? "BIÊN LAI" : value.pattern.startsWith("2") ? "HÓA ĐƠN BÁN HÀNG" : "HÓA ĐƠN GIÁ TRỊ GIA TĂNG"}</h3>
    <p>Hóa đơn {index + 1} · {mode === "multi" ? "Nhiều thuế suất" : "Một thuế suất"} · Ngày {value.date ? value.date.split("-").reverse().join("/") : "hiện tại do API xác định"}</p>
    <dl><dt>Ký hiệu</dt><dd>{value.pattern || "API tự chọn dải"} {value.serial}</dd><dt>Đơn vị mua</dt><dd>{value.customer || "—"}</dd><dt>Người mua</dt><dd>{value.buyer || "—"}</dd><dt>Mã số thuế</dt><dd>{value.tax || "—"}</dd><dt>Địa chỉ</dt><dd>{value.address || "—"}</dd><dt>Thanh toán</dt><dd>{value.payment || "—"}</dd></dl>
    <div className="invoice-document-table"><table><thead><tr><th>STT</th><th>Tên hàng hóa, dịch vụ</th><th>Trước thuế</th>{mode === "multi" && <th>Thuế suất</th>}<th>Tiền thuế</th><th>Thanh toán</th></tr></thead><tbody>{value.products.map((row, i) => { const amounts = calculateProduct(row); const signed = (amount: number) => row.feature === "3" ? -Math.abs(amount) : amount; return <tr key={i}><td>{i + 1}</td><td>{row.name || "—"}</td><td>{money(signed(amounts.total))}</td>{mode === "multi" && <td>{vatLabel(row.vat, row.vatRateOther)}</td>}<td>{money(signed(amounts.vatAmount))}</td><td>{money(signed(amounts.amount))}</td></tr>; })}</tbody></table></div>
    <dl className="document-totals"><dt>Tổng trước thuế</dt><dd>{money(totals.total)}</dd><dt>Tiền thuế GTGT</dt><dd>{money(totals.vat)}</dd><dt>Tổng thanh toán ({value.currency})</dt><dd><strong>{money(totals.amount)}</strong></dd></dl>
    {mode === "multi" && <section className="gross-preview"><div><h4>Gross theo nhóm thuế suất</h4><p>API tự lập 10 nhóm từ VATRate từng dòng; không gửi bộ Gross trong XML.</p></div><div className="invoice-document-table"><table><thead><tr><th>Nhóm</th><th>Số dòng</th><th>GrossValue</th><th>VATAmount</th><th>Amount</th></tr></thead><tbody>{gross.map((group) => <tr key={group.rate} className={group.count ? "gross-active" : undefined}><td>{vatLabel(group.rate, group.otherRates.join(", "))}{group.otherRates.length > 1 ? ` (${group.otherRates.join("%, ")}%)` : ""}</td><td>{group.count}</td><td>{money(group.total)}</td><td>{money(group.vat)}</td><td>{money(group.amount)}</td></tr>)}</tbody></table></div></section>}
    <p><strong>Số tiền bằng chữ:</strong> {value.amountInWords || "—"}</p>
    <small>Minh họa từ dữ liệu nhập; bố cục hóa đơn thật phụ thuộc mẫu đăng ký trên Softdreams.</small>
  </article>;
}
