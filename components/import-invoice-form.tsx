"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp, MapPin, Plus, Trash2, UserRound } from "lucide-react";
import { calculateInvoice, calculateProduct, initialInvoice, VAT_RATES, FEATURES, type InvoiceInput } from "@/lib/softdreams/invoice";
import { amountInWordsVnd } from "@/lib/softdreams/amount-in-words";
import { SpecialExtraFields } from "./special-extra-fields";
import { DateInput } from "./date-input";
import { StyledSelect } from "./styled-select";
import type { XmlSelection } from "@/lib/softdreams/xml-selection";
import { invoiceFieldExplanation } from "@/lib/softdreams/invoice-field-explanation";
import { IMPORT_FIELD_HELP } from "@/lib/softdreams/import-field-help";
import { invoiceAmountStatus } from "@/lib/softdreams/invoice-amount-status";
import { VIETNAM_COMMUNES, VIETNAM_PROVINCES } from "@/lib/softdreams/vietnam-admin-units";
import { multiVatLineTotals, recalculateMultiVatProduct, roundInvoiceMoney, syncMultiVatInvoice } from "@/lib/softdreams/multi-vat";

type Issue = { field: string; message: string };
type InvoiceTextKey = { [K in keyof InvoiceInput]: InvoiceInput[K] extends string ? K : never }[keyof InvoiceInput];
const currencies = ["VND – đồng", "USD – đô la Mỹ", "EUR – Euro", "JPY – Yên", "GBP – bảng Anh", "SGD – đô la Sing", "MYR – đô la Malaysia", "HKD – đô la Hồng Kông", "KRW – Won", "AUD – đô la Úc", "NOK – đô la Na-uy"];

export function ImportInvoiceForm({ value, onChange, issues, explanation, onCloseExplanation, mode, onModeChange }: {
  value: InvoiceInput; onChange: (value: InvoiceInput) => void; issues: Issue[];
  explanation: XmlSelection | null; onCloseExplanation: () => void;
  mode: "single" | "multi"; onModeChange: (mode: "single" | "multi") => void;
}) {
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [location, setLocation] = useState(false);
  const [extraBuyer, setExtraBuyer] = useState(false);
  const [wordError, setWordError] = useState("");
  const [wordsEdited, setWordsEdited] = useState(false);
  const [modeNotice, setModeNotice] = useState("");
  const totals = calculateInvoice(value);
  const multiLineTotals = multiVatLineTotals(value);
  const multiTotalsMismatch = mode === "multi" && [
    Number(value.totalOverride || multiLineTotals.total) !== multiLineTotals.total,
    Number(value.vatAmountOverride || multiLineTotals.vat) !== multiLineTotals.vat,
    Number(value.amountOverride || multiLineTotals.amount) !== multiLineTotals.amount,
  ].some(Boolean);
  const amountStatus = invoiceAmountStatus(value);
  const car = value.specialInvoice === "1";
  const showBuyer = extraBuyer || car || !!value.identification || !!value.phone || !!value.provinceCode || !!value.provinceName || !!value.communeCode || !!value.communeName;
  const communeOptions = VIETNAM_COMMUNES[value.provinceCode] ?? [];
  const showLocation = location || !!value.locationCode || !!value.locationName || !!value.locationAddress;
  const needsBuyerDetails = value.profile !== "receipt" && (!!value.tax || car);
  const selectedExplanation = explanation ? invoiceFieldExplanation(value, explanation) : null;
  const format = (next: string | number) => typeof next === "number" ? Number.isFinite(next) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(next) : "—" : next || "(chưa nhập)";
  const update = <K extends keyof InvoiceInput>(key: K, next: InvoiceInput[K]) => onChange({ ...value, [key]: next });
  const commitMultiProducts = (products: InvoiceInput["products"]) => {
    let next = syncMultiVatInvoice(value, products);
    if (!wordsEdited && next.currency === "VND") {
      try { next = { ...next, amountInWords: amountInWordsVnd(Number(next.amountOverride)) }; } catch { /* Keep the current words when the amount cannot be read. */ }
    }
    onChange(next);
  };
  const productUpdate = (index: number, change: Partial<InvoiceInput["products"][number]>, recalculate = false) => {
    const products = value.products.map((row, i) => {
      if (i !== index) return row;
      const changed = { ...row, ...change };
      return mode === "multi" && recalculate ? recalculateMultiVatProduct(changed, value.currency) : changed;
    });
    if (mode === "multi") commitMultiProducts(products); else update("products", products);
  };
  const switchMode = (next: "single" | "multi") => {
    if (next === "single") {
      const rates = new Set(value.products.map((product) => `${product.vat}:${product.vatRateOther}`));
      setModeNotice(rates.size > 1 ? "Các dòng đang có nhiều thuế suất. Khi về 1 thuế, hệ thống lấy thuế suất dòng đầu làm mức chung; dòng Feature đặc biệt vẫn giữ thuế riêng." : "");
    } else setModeNotice("");
    onModeChange(next);
  };
  function field(key: string, tag: string, label: string, required: boolean, help: string, control: ReactNode, _optional = false, index?: number) {
    const messages = issues.filter((issue) => issue.field === key);
    const selected = explanation?.tag === tag && explanation.scope === (index === undefined ? "invoice" : "product") && explanation.index === index;
    const buyerChoice = index === undefined && value.profile !== "receipt" && ["CusName", "Buyer"].includes(tag);
    if (requiredOnly && !required && !buyerChoice && !messages.length && !selected) return null;
    const helpId = `import-help-${encodeURIComponent(key)}`;
    const reference = IMPORT_FIELD_HELP[`${index === undefined ? "" : "P."}${tag}`];
    return <label key={key} id={`invoice-field-${encodeURIComponent(key)}`} className="field" data-request-selected={selected || undefined} data-invalid={messages.length > 0 || undefined} data-xml-tag={tag} data-xml-scope={index === undefined ? "invoice" : "product"} data-xml-index={index}>
      <span><span className="field-label-text"><code>{tag}</code> · {label}</span><span className="field-label-suffix">{required && <b className="required-star">*</b>}<span className="import-help-anchor" tabIndex={0} aria-label={`Giải thích ${tag}`}><CircleHelp size={14} /><span id={helpId} className="import-field-help" role="tooltip"><strong>Trên web: {reference?.web ?? label}</strong><span>{reference?.rule ?? help}</span>{reference?.error && <span className="import-help-error"><strong>Lỗi thường gặp:</strong> {reference.error}</span>}</span></span></span></span>
      {control}{messages.length > 0 && <div className="field-validation-messages">{messages.map((message, i) => <small className="field-validation-message" key={i}>{message.message}</small>)}</div>}
    </label>;
  }
  const input = (key: InvoiceTextKey, maxLength?: number) => <input value={value[key]} maxLength={maxLength} onChange={(event) => update(key, event.target.value)} />;
  return <div className="import-content-form">
    {selectedExplanation && <aside className="import-formula" role="status"><button type="button" className="subtle-button" aria-label="Đóng giải thích" onClick={onCloseExplanation}>×</button><strong>{selectedExplanation.field} · {selectedExplanation.where}</strong><p className="import-formula-expression">{selectedExplanation.formula}</p><p>Đang nhập: <b>{format(selectedExplanation.actual)}</b>{selectedExplanation.expected !== undefined && <> · Đối chiếu: <b>{format(selectedExplanation.expected)}</b></>}</p>{selectedExplanation.matches !== undefined && <p className={selectedExplanation.matches ? "formula-matches" : "formula-differs"}>{selectedExplanation.matches ? "Khớp công thức gợi ý" : "Lệch so với công thức gợi ý · kiểm tra lại chứng từ"}</p>}<p>{selectedExplanation.note}</p></aside>}
    <section className="import-tax-description tax-mode-section">
      <div className="tax-mode-header"><div><strong>Kiểu mẫu thuế</strong><span>{mode === "single" ? "Một mức thuế dùng chung cho hóa đơn" : "VAT riêng theo từng dòng hàng"}</span></div><div className="tax-mode-tabs" role="group" aria-label="Chọn kiểu mẫu thuế"><button type="button" className={mode === "single" ? "active" : ""} aria-pressed={mode === "single"} onClick={() => switchMode("single")}>1 thuế</button><button type="button" className={mode === "multi" ? "active" : ""} aria-pressed={mode === "multi"} onClick={() => switchMode("multi")}>Nhiều thuế</button></div></div>
      <p>{mode === "single" ? "Khai VATRate ở hóa đơn; các dòng sản phẩm kế thừa cùng thuế suất." : "Khai VATRate và VATAmount tại từng dòng sản phẩm; XML sẽ gửi thuế suất riêng trong từng Product."}</p>
      {modeNotice && <p className="multi-vat-notice" role="status">{modeNotice}</p>}
    </section>
    <div className="import-section-heading"><h3>Hóa đơn (<code>&lt;Invoice&gt;</code>)</h3></div>
    <label className="import-inline-check"><input type="checkbox" checked={requiredOnly} onChange={(event) => setRequiredOnly(event.target.checked)} />Chỉ hiện các trường bắt buộc (ẩn ô tùy chọn cho gọn)</label>
    <div className="form-grid import-invoice-grid">
      {field("ikey", "Ikey", "Khóa tích hợp", true, "Khóa duy nhất của mỗi hóa đơn. Không trùng với hóa đơn khác trong gói hoặc hóa đơn đã có trên Softdreams.", input("ikey"))}
      {field("payment", "PaymentMethod", "Hình thức thanh toán", true, "Bắt buộc, tối đa 50 ký tự.", <StyledSelect value={value.payment} onChange={(payment) => update("payment", payment)} options={["Tiền mặt", "Chuyển khoản", "Tiền mặt/Chuyển khoản", "Đối trừ công nợ", "Không thu tiền"].map((label) => ({ value: label, label }))} />)}
      {field("customer", "CusName", `Tên đơn vị mua${value.profile !== "receipt" && !value.tax && !car ? " (điền 1 trong 2)" : ""}`, needsBuyerDetails, "Ít nhất một trong CusName/Buyer phải có giá trị với mẫu TT78. Có mã số thuế thì CusName và CusAddress bắt buộc.", input("customer", 400))}
      {field("buyer", "Buyer", "Tên người mua hàng (điền 1 trong 2)", false, "Khách lẻ có thể chỉ điền Buyer; tối đa 100 ký tự. Không để trống đồng thời Buyer và CusName.", input("buyer", 100))}
      {value.profile !== "receipt" && <p className="import-full-note">Cần điền ít nhất một trong CusName hoặc Buyer: khách lẻ điền Buyer, khách là đơn vị điền CusName. Có CusTaxCode thì bắt buộc cả CusName và CusAddress.</p>}
      {field("tax", "CusTaxCode", "Mã số thuế người mua", car, "10 số, 10 số-3 số hoặc 12 số; khoảng trắng được loại bỏ khi gửi.", input("tax"), true)}
      {field("address", "CusAddress", "Địa chỉ người mua", needsBuyerDetails, "Bắt buộc khi có mã số thuế hoặc dải mua bán xe với mẫu TT78. Tối đa 400 ký tự.", input("address", 400), true)}
      {field("date", "ArisingDate", "Ngày phát sinh (trống = hôm nay)", false, "Không có công thức, nhập trực tiếp. XML dùng dd/MM/yyyy; năm phải khớp Pattern. Trống: API lấy ngày hiện tại.", <DateInput value={value.date} onChange={(event) => update("date", event.target.value)} />, true)}
      {field("currency", "CurrencyUnit", "Đơn vị tiền tệ", value.profile !== "receipt", "VND làm tròn đến đồng; ngoại tệ làm tròn 2 chữ số thập phân.", <StyledSelect value={value.currency} onChange={(currency) => { if (mode === "multi") { const products = value.products.map((product) => recalculateMultiVatProduct(product, currency)); let next = syncMultiVatInvoice({ ...value, currency }, products); if (!wordsEdited && currency === "VND") next = { ...next, amountInWords: amountInWordsVnd(Number(next.amountOverride)) }; onChange(next); } else update("currency", currency); }} options={currencies.map((label) => ({ value: label.slice(0, 3), label }))} />)}
      {(value.currency !== "VND" || value.exchangeRate || issues.some((issue) => issue.field === "exchangeRate")) && field("exchangeRate", "ExchangeRate", "Tỷ giá so với VND", false, "Nhập tỷ giá trực tiếp theo chứng từ. Form không tự quy đổi toàn bộ số tiền khi thay đổi tỷ giá.", input("exchangeRate"), true)}
      {field("totalOverride", "Total", "Tổng tiền trước thuế", true, "Gợi ý: tổng Total của các dòng hàng, có xét Feature. Có thể nhập riêng theo chứng từ.", <input type="number" step="any" value={value.totalOverride === "" ? totals.subtotal : value.totalOverride} onChange={(event) => update("totalOverride", event.target.value)} />)}
      {field("vatAmountOverride", "VATAmount", "Tổng tiền thuế GTGT", false, "Gợi ý: tổng VATAmount của các dòng. Có thể nhập riêng; không giả định API tự sửa mọi phép tính.", <input type="number" step="any" value={value.vatAmountOverride === "" ? totals.calculatedVat : value.vatAmountOverride} onChange={(event) => update("vatAmountOverride", event.target.value)} />, true)}
      {mode === "single" && field("vatRate", "VATRate", "Thuế suất hóa đơn (các dòng lấy theo)", true, "Mẫu một thuế: thay đổi tại đây để áp dụng cho tất cả dòng. Thuế -3 cần VATRateOther; -5 cần toàn hóa đơn cùng CTTC.", <StyledSelect value={value.vatRate} onChange={(next) => {
        const rate = Number(next); onChange({ ...value, vatRate: rate, ...(mode === "single" ? { products: value.products.map((row) => ({ ...row, vat: rate, vatRateOther: value.vatRateOther })) } : {}) });
      }} options={VAT_RATES.map(([rate, label]) => ({ value: rate, label: `${rate} · ${label}` }))} />)}
      {field("amountOverride", "Amount", "Tổng tiền thanh toán", true, "Amount = Total + VATAmount. Cần tính hoặc nhập tổng tiền trước khi gửi.", <div className="amount-total-control"><input type="number" step="any" value={value.amountOverride} placeholder="Chưa tính tổng tiền thanh toán" onChange={(event) => update("amountOverride", event.target.value)} /><button type="button" className="subtle-button" disabled={amountStatus.expected === undefined} onClick={() => { if (amountStatus.expected !== undefined) update("amountOverride", String(amountStatus.expected)); }}>Tính lại Amount</button><small>{amountStatus.expected === undefined ? "Kiểm tra Total và VATAmount trước khi tính tổng." : `Total + VATAmount = ${format(amountStatus.expected)} ${value.currency}`}</small></div>)}
      {mode === "single" && value.vatRate === -3 && field("vatRateOther", "VATRateOther", "Thuế suất khác (%)", true, "Giá trị từ 0 đến 99.99, tối đa 2 chữ số thập phân.", <input type="number" step="0.01" min="0" max="99.99" value={value.vatRateOther} onChange={(event) => onChange({ ...value, vatRateOther: event.target.value, products: value.products.map((row) => ({ ...row, vatRateOther: event.target.value })) })} />)}
      {field("amountInWords", "AmountInWords", "Số tiền viết bằng chữ", value.profile !== "receipt", "API nhận chuỗi bạn gửi. Nút Điền theo Amount đọc số nguyên VND tại trình duyệt; hãy đối chiếu số tiền trước khi gửi.", <div className="amount-words-control"><input value={value.amountInWords} maxLength={255} onChange={(event) => { setWordsEdited(true); update("amountInWords", event.target.value); }} /><button type="button" className="subtle-button" disabled={value.currency !== "VND"} onClick={() => { try { update("amountInWords", amountInWordsVnd(totals.amount)); setWordsEdited(false); setWordError(""); } catch (error) { setWordError(error instanceof Error ? error.message : "Không đọc được số tiền."); } }}>Điền theo Amount</button>{wordError && <small role="alert">{wordError}</small>}</div>)}
      {field("listAttachNum", "ListAttachNum", "Số bảng kê", false, "Có thể cần cùng ngày bảng kê khi dữ liệu tiền âm/chiết khấu yêu cầu bảng kê.", input("listAttachNum"), true)}
      {field("listAttachDate", "ListAttachDate", "Ngày bảng kê", false, "Nhập trực tiếp; gửi XML theo dd/MM/yyyy.", <DateInput value={value.listAttachDate} onChange={(event) => update("listAttachDate", event.target.value)} />, true)}
    </div>
    {mode === "multi" && <aside className={`multi-vat-summary ${multiTotalsMismatch ? "is-warning" : ""}`}>
      <div><strong>{multiTotalsMismatch ? "Tổng hóa đơn đang lệch tổng các dòng" : "Tổng nhiều thuế đã khớp các dòng"}</strong><span>Total {format(multiLineTotals.total)} · VATAmount {format(multiLineTotals.vat)} · Amount {format(multiLineTotals.amount)} {value.currency}</span></div>
      {multiTotalsMismatch && <button type="button" className="subtle-button" onClick={() => commitMultiProducts(value.products)}>Lấy lại tổng từ các dòng</button>}
    </aside>}

    <section className="import-products" id="invoice-field-products"><h3>Sản phẩm (<code>&lt;Product&gt;</code>)</h3>
      {value.products.map((product, index) => { const amounts = calculateProduct(product); const prefix = `products[${index}]`; return <section className="import-product" key={index}>
        <div className="import-section-heading"><h4>Sản phẩm {index + 1}</h4><button type="button" className="subtle-button" disabled={value.products.length === 1} aria-label={`Xóa sản phẩm ${index + 1}`} onClick={() => { const products = value.products.filter((_, i) => i !== index); if (mode === "multi") commitMultiProducts(products); else update("products", products); }}><Trash2 size={14} />Xóa</button></div>
        <div className="form-grid">
          {field(`${prefix}.no`, "No", "Số thứ tự", false, "Tự đánh số liên tục từ 1 theo vị trí dòng; thêm/xóa sản phẩm sẽ đánh lại số.", <input value={index + 1} readOnly />, true, index)}
          {field(`${prefix}.feature`, "Feature", "Loại sản phẩm", false, "1 hàng hóa; 2 khuyến mại; 3 chiết khấu; 4 ghi chú; 5 hàng hóa đặc trưng. Không gửi Feature: API tự suy loại dòng từ Amount.", <StyledSelect value={product.feature} onChange={(feature) => productUpdate(index, { feature, ...(feature !== "5" ? { extra: "" } : {}) })} options={[{ value: "", label: "Không gửi · API tự suy loại dòng" }, ...FEATURES.map(([feature, label]) => ({ value: feature, label: `${feature} · ${label}` }))]} />, true, index)}
          {field(`${prefix}.name`, "ProdName", "Tên sản phẩm", true, "Tên hàng hóa/dịch vụ, tối đa 500 ký tự.", <input value={product.name} maxLength={500} onChange={(event) => productUpdate(index, { name: event.target.value })} />, false, index)}
          {field(`${prefix}.totalOverride`, "Total", "Thành tiền (chưa thuế)", true, "Nhập thành tiền của dòng, chưa thuế, theo mẫu HTML.", <input type="number" step="any" value={product.totalOverride === "" ? amounts.total : product.totalOverride} onChange={(event) => productUpdate(index, { totalOverride: event.target.value }, mode === "multi")} />, false, index)}
          {mode === "multi" && field(`${prefix}.vat`, "VATRate", "Thuế suất dòng", true, "Bắt buộc khai riêng cho từng Product. Đổi thuế suất sẽ tính lại VATAmount, Amount và tổng hóa đơn.", <StyledSelect value={product.vat} onChange={(next) => { const changed = { ...product, vat: Number(next), ...(Number(next) !== -3 ? { vatRateOther: "" } : {}) }; const recalculated = recalculateMultiVatProduct(changed, value.currency, true); productUpdate(index, recalculated); }} options={VAT_RATES.map(([rate, label]) => ({ value: rate, label: `${rate} · ${label}` }))} />, false, index)}
          {mode === "multi" && product.vat === -3 && field(`${prefix}.vatRateOther`, "VATRateOther", "Thuế suất khác (%)", true, "Bắt buộc khi VATRate dòng là -3; từ 0 đến 99.99.", <input type="number" step="0.01" min="0" max="99.99" value={product.vatRateOther} onChange={(event) => productUpdate(index, { vatRateOther: event.target.value }, true)} />, false, index)}
          {field(`${prefix}.vatAmountOverride`, "VATAmount", mode === "multi" ? "Tiền thuế dòng (nên gửi)" : "Tiền thuế dòng", mode === "multi", "API không tự tính VATAmount khi dòng có VATRate riêng; thiếu thẻ này hệ thống có thể lưu thuế dòng bằng 0.", <input type="number" step="any" value={product.vatAmountOverride === "" ? amounts.vatAmount : product.vatAmountOverride} onChange={(event) => { const vatAmountOverride = event.target.value; const total = Number(product.totalOverride === "" ? amounts.total : product.totalOverride); productUpdate(index, { vatAmountOverride, amountOverride: vatAmountOverride === "" ? "" : String(roundInvoiceMoney(total + Number(vatAmountOverride), value.currency)) }); }} />, true, index)}
          {field(`${prefix}.amountOverride`, "Amount", "Cộng (đã thuế)", true, "Gợi ý: Total + VATAmount. XSD yêu cầu Amount là số không rỗng.", <input type="number" step="any" value={product.amountOverride === "" ? amounts.amount : product.amountOverride} onChange={(event) => productUpdate(index, { amountOverride: event.target.value })} />, false, index)}
        </div>

        {product.feature === "5" && value.specialInvoice !== "0" && <div id={`invoice-field-${encodeURIComponent(`${prefix}.extra`)}`} className="product-special-extra" data-xml-tag="Extra" data-xml-scope="product" data-xml-index={index}><strong>Extra · Thông tin hàng hóa đặc trưng<b className="required-star">*</b></strong><SpecialExtraFields reference type={value.specialInvoice} value={product.extra} onChange={(extra) => productUpdate(index, { extra })} /></div>}
      </section>; })}
      <button type="button" className="subtle-button" onClick={() => { const products = [...value.products, { ...initialInvoice.products[0], code: "", name: "", feature: value.specialInvoice === "0" ? "1" : "5", quantity: 1, price: 0, vat: mode === "multi" ? value.products[0]?.vat ?? value.vatRate : value.vatRate, vatRateOther: value.vatRateOther, totalOverride: "", vatAmountOverride: "", amountOverride: "", extra: "" }]; if (mode === "multi") commitMultiProducts(products); else update("products", products); }}><Plus size={14} />Thêm sản phẩm</button>
    </section>

    <section className="import-conditional-fields">
      <div className="import-section-heading"><h3>Thông tin bổ sung</h3></div>
      <div className="import-expand-card" data-open={showBuyer}>
      <label className="import-expand-toggle"><input type="checkbox" checked={showBuyer} disabled={car} aria-expanded={showBuyer} aria-controls="import-buyer-panel" onChange={(event) => { setExtraBuyer(event.target.checked); if (!event.target.checked) onChange({ ...value, identification: "", phone: "", provinceCode: "", provinceName: "", communeCode: "", communeName: "" }); }} /><UserRound size={19} className="import-expand-icon" /><span><strong>Thông tin người mua bổ sung</strong><small>CCCD, điện thoại, tỉnh/thành phố và xã/phường</small></span><em>{car ? "Dải mua bán xe" : "Tùy chọn"}</em><ChevronDown size={17} className="import-expand-chevron" /></label>
      {showBuyer && <div className="import-expand-body" id="import-buyer-panel"><p className="import-expand-hint">{car ? "Tự mở theo dải mua bán xe. Điền các trường có dấu *; CCCD là thông tin bổ sung." : "Chỉ điền khi cần bổ sung thông tin người mua."} Tỉnh và xã dùng danh mục hành chính cố định theo Quyết định 19/2025/QĐ-TTg.</p><div className="form-grid">
        {field("identification", "CusIdentification", "CCCD", false, "9 hoặc 12 chữ số.", input("identification"))}
        {field("phone", "CusPhone", "Điện thoại", car, "Bắt buộc khi cấu hình dải là mua bán xe.", input("phone"))}
        {field("provinceCode", "ProvinceCode", "Mã tỉnh/thành phố", car, "Chọn từ danh mục hành chính; hệ thống tự điền đồng thời ProvinceCode và ProvinceName.", <StyledSelect searchable searchPlaceholder="Tìm mã hoặc tên tỉnh/thành phố..." value={value.provinceCode} onChange={(provinceCode) => { const province = VIETNAM_PROVINCES.find((item) => item.code === provinceCode); onChange({ ...value, provinceCode, provinceName: province?.name ?? "", communeCode: "", communeName: "" }); }} options={[{ value: "", label: "Chọn tỉnh/thành phố" }, ...VIETNAM_PROVINCES.map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` }))]} />)}
        {field("provinceName", "ProvinceName", "Tên tỉnh/thành phố", car, "Tự động lấy theo mã tỉnh đã chọn, không nhập thủ công.", <input value={value.provinceName} readOnly placeholder="Tự điền theo mã tỉnh" />)}
        {field("communeCode", "CommuneCode", "Mã xã/phường", car, "Chỉ hiển thị xã/phường thuộc tỉnh đã chọn; hệ thống tự điền đồng thời CommuneCode và CommuneName.", <StyledSelect searchable searchPlaceholder="Tìm mã hoặc tên xã/phường..." value={value.communeCode} disabled={!value.provinceCode} onChange={(communeCode) => { const commune = communeOptions.find((item) => item.code === communeCode); onChange({ ...value, communeCode, communeName: commune?.name ?? "" }); }} options={[{ value: "", label: value.provinceCode ? "Chọn xã/phường" : "Chọn tỉnh trước" }, ...communeOptions.map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` }))]} />)}
        {field("communeName", "CommuneName", "Tên xã/phường", car, "Tự động lấy theo mã xã/phường đã chọn, không nhập thủ công.", <input value={value.communeName} readOnly placeholder="Tự điền theo mã xã/phường" />)}
      </div></div>}
      </div>
      <div className="import-expand-card" data-open={showLocation}>
      <label className="import-expand-toggle"><input type="checkbox" checked={showLocation} aria-expanded={showLocation} aria-controls="import-location-panel" onChange={(event) => { setLocation(event.target.checked); if (!event.target.checked) onChange({ ...value, locationCode: "", locationName: "", locationAddress: "" }); }} /><MapPin size={19} className="import-expand-icon" /><span><strong>Địa điểm kinh doanh</strong><small>Bổ sung mã, tên và địa chỉ địa điểm kinh doanh</small></span><em>Tùy chọn</em><ChevronDown size={17} className="import-expand-chevron" /></label>
      {showLocation && <div className="import-expand-body" id="import-location-panel"><p className="import-expand-hint">Cả ba trường trống: hệ thống có thể tự điền theo cấu hình công ty.</p><div className="form-grid import-location-fields">{([ ["locationCode", "LocationCode", "Mã địa điểm"], ["locationName", "LocationName", "Tên địa điểm"], ["locationAddress", "LocationAddress", "Địa chỉ địa điểm"] ] as const).map(([key, tag, label]) => field(key, tag, label, false, key === "locationCode" ? "Không bắt buộc, tối đa 5 ký tự. Cả ba trống: API tự điền nếu công ty đã cấu hình." : "Không bắt buộc, tối đa 400 ký tự.", input(key)))}</div></div>}
      </div>
    </section>
    <details className="import-unsupported-note"><summary>Lưu ý về các trường API chưa hỗ trợ</summary><p className="import-full-note">API hiện chưa nhận các thẻ người mua nước ngoài theo NĐ 254 (CusForeignOrgId, NationalityCode, CusNationality) và BusinessProdGroupCode. Gửi các thẻ này sẽ bị lỗi 400 nên sandbox không có ô nhập.</p></details>
  </div>;
}
