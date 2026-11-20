"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp, MapPin, Plus, Trash2, UserRound } from "lucide-react";
import { calculateInvoice, calculateProduct, initialInvoice, VAT_RATES, FEATURES, type InvoiceInput } from "@/lib/softdreams/invoice";
import { amountInWordsVnd } from "@/lib/softdreams/amount-in-words";
import { SpecialExtraFields } from "./special-extra-fields";
import { DateInput } from "./date-input";
import { StyledSelect } from "./styled-select";
import type { CompanySimulation } from "@/lib/softdreams/company-preview";
import type { XmlSelection } from "@/lib/softdreams/xml-selection";
import { invoiceFieldExplanation } from "@/lib/softdreams/invoice-field-explanation";
import { IMPORT_FIELD_HELP } from "@/lib/softdreams/import-field-help";

type Issue = { field: string; message: string };
type InvoiceTextKey = { [K in keyof InvoiceInput]: InvoiceInput[K] extends string ? K : never }[keyof InvoiceInput];
const currencies = ["VND – đồng", "USD – đô la Mỹ", "EUR – Euro", "JPY – Yên", "GBP – bảng Anh", "SGD – đô la Sing", "MYR – đô la Malaysia", "HKD – đô la Hồng Kông", "KRW – Won", "AUD – đô la Úc", "NOK – đô la Na-uy"];

export function ImportInvoiceForm({ value, onChange, issues, simulation, onSimulationChange, explanation, onCloseExplanation }: {
  value: InvoiceInput; onChange: (value: InvoiceInput) => void; issues: Issue[];
  simulation: CompanySimulation; onSimulationChange: (value: CompanySimulation) => void;
  explanation: XmlSelection | null; onCloseExplanation: () => void;
}) {
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [location, setLocation] = useState(false);
  const [extraBuyer, setExtraBuyer] = useState(false);
  const [wordError, setWordError] = useState("");
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const totals = calculateInvoice(value);
  const car = value.specialInvoice === "1";
  const showBuyer = extraBuyer || car || !!value.identification || !!value.phone || !!value.provinceCode || !!value.provinceName || !!value.communeCode || !!value.communeName;
  const showLocation = location || !!value.locationCode || !!value.locationName || !!value.locationAddress;
  const needsBuyerDetails = value.profile !== "receipt" && (!!value.tax || car);
  const selectedExplanation = explanation ? invoiceFieldExplanation(value, explanation) : null;
  const format = (next: string | number) => typeof next === "number" ? Number.isFinite(next) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(next) : "—" : next || "(chưa nhập)";
  const update = <K extends keyof InvoiceInput>(key: K, next: InvoiceInput[K]) => onChange({ ...value, [key]: next });
  const productUpdate = (index: number, change: Partial<InvoiceInput["products"][number]>) => update("products", value.products.map((row, i) => i === index ? { ...row, ...change } : row));
  function field(key: string, tag: string, label: string, required: boolean, help: string, control: ReactNode, _optional = false, index?: number) {
    const messages = issues.filter((issue) => issue.field === key);
    const selected = explanation?.tag === tag && explanation.scope === (index === undefined ? "invoice" : "product") && explanation.index === index;
    const buyerChoice = index === undefined && value.profile !== "receipt" && ["CusName", "Buyer"].includes(tag);
    if (requiredOnly && !required && !buyerChoice && !messages.length && !selected) return null;
    const helpId = `import-help-${encodeURIComponent(key)}`;
    const reference = IMPORT_FIELD_HELP[`${index === undefined ? "" : "P."}${tag}`];
    return <label key={key} id={`invoice-field-${encodeURIComponent(key)}`} className="field" data-request-selected={selected || undefined} data-invalid={messages.length > 0 || undefined} data-xml-tag={tag} data-xml-scope={index === undefined ? "invoice" : "product"} data-xml-index={index}>
      <span><span className="field-label-text"><code>{tag}</code> · {label}</span>{required && <b className="required-star">*</b>}<button type="button" className="import-help-toggle" aria-label={`Giải thích ${tag}`} aria-expanded={openHelp === key} aria-controls={helpId} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpenHelp(openHelp === key ? null : key); }}><CircleHelp size={14} /></button></span>
      {control}{(messages.length > 0 || openHelp === key) && <div className="field-validation-messages">{openHelp === key && <div id={helpId} className="import-field-help"><strong>Trên web: {reference?.web ?? label}</strong><p>{reference?.rule ?? help}</p>{reference?.error && <p className="import-help-error"><strong>Lỗi thường gặp:</strong> {reference.error}</p>}</div>}{messages.map((message, i) => <small className="field-validation-message" key={i}>{message.message}</small>)}</div>}
    </label>;
  }
  const input = (key: InvoiceTextKey, maxLength?: number) => <input value={value[key]} maxLength={maxLength} onChange={(event) => update(key, event.target.value)} />;
  return <div className="import-content-form">
    {selectedExplanation && <aside className="import-formula" role="status"><button type="button" className="subtle-button" aria-label="Đóng giải thích" onClick={onCloseExplanation}>×</button><strong>{selectedExplanation.field} · {selectedExplanation.where}</strong><p className="import-formula-expression">{selectedExplanation.formula}</p><p>Đang nhập: <b>{format(selectedExplanation.actual)}</b>{selectedExplanation.expected !== undefined && <> · Đối chiếu: <b>{format(selectedExplanation.expected)}</b></>}</p>{selectedExplanation.matches !== undefined && <p className={selectedExplanation.matches ? "formula-matches" : "formula-differs"}>{selectedExplanation.matches ? "Khớp công thức gợi ý" : "Lệch so với công thức gợi ý · kiểm tra lại chứng từ"}</p>}<p>{selectedExplanation.note}</p></aside>}
    <section className="import-tax-description">
      <div className="import-section-heading"><h3>Kiểu mẫu: một thuế suất</h3></div>
      <p>Một thuế suất: khai VATRate ở hóa đơn, dòng để trống thì lấy theo hóa đơn. VATAmount dòng chỉ tự tính khi dòng không gửi Feature, không gửi VATAmount và kế thừa thuế suất hóa đơn.</p>
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
      {field("currency", "CurrencyUnit", "Đơn vị tiền tệ", value.profile !== "receipt", "Chọn đồng tiền; biên lai chỉ dùng VND. Việc làm tròn phụ thuộc CurrencyUnit và cấu hình API.", <StyledSelect value={value.currency} onChange={(currency) => update("currency", currency)} options={currencies.map((label) => ({ value: label.slice(0, 3), label }))} />)}
      {(value.currency !== "VND" || value.exchangeRate || issues.some((issue) => issue.field === "exchangeRate")) && field("exchangeRate", "ExchangeRate", "Tỷ giá so với VND", false, "Nhập tỷ giá trực tiếp theo chứng từ. Form không tự quy đổi toàn bộ số tiền khi thay đổi tỷ giá.", input("exchangeRate"), true)}
      {field("totalOverride", "Total", "Tổng tiền trước thuế", true, "Gợi ý: tổng Total của các dòng hàng, có xét Feature. Có thể nhập riêng theo chứng từ.", <input type="number" step="any" value={value.totalOverride === "" ? totals.subtotal : value.totalOverride} onChange={(event) => update("totalOverride", event.target.value)} />)}
      {field("vatAmountOverride", "VATAmount", "Tổng tiền thuế GTGT", false, "Gợi ý: tổng VATAmount của các dòng. Có thể nhập riêng; không giả định API tự sửa mọi phép tính.", <input type="number" step="any" value={value.vatAmountOverride === "" ? totals.calculatedVat : value.vatAmountOverride} onChange={(event) => update("vatAmountOverride", event.target.value)} />, true)}
      {field("vatRate", "VATRate", "Thuế suất hóa đơn (các dòng lấy theo)", true, "Mẫu một thuế: thay đổi tại đây để áp dụng cho tất cả dòng. Thuế -3 cần VATRateOther; -5 cần toàn hóa đơn cùng CTTC.", <StyledSelect value={value.vatRate} onChange={(next) => {
        const rate = Number(next); onChange({ ...value, vatRate: rate, products: value.products.map((row) => ({ ...row, vat: rate, vatRateOther: value.vatRateOther })) });
      }} options={VAT_RATES.map(([rate, label]) => ({ value: rate, label: `${rate} · ${label}` }))} />)}
      {field("amountOverride", "Amount", "Tổng tiền thanh toán", true, "Gợi ý: Total + VATAmount hoặc tổng Amount dòng. Giá trị nhập riêng được ưu tiên.", <input type="number" step="any" value={value.amountOverride === "" ? totals.amount : value.amountOverride} onChange={(event) => update("amountOverride", event.target.value)} />)}
      {value.vatRate === -3 && field("vatRateOther", "VATRateOther", "Thuế suất khác (%)", true, "Giá trị từ 0 đến 99.99, tối đa 2 chữ số thập phân.", <input type="number" step="0.01" min="0" max="99.99" value={value.vatRateOther} onChange={(event) => onChange({ ...value, vatRateOther: event.target.value, products: value.products.map((row) => ({ ...row, vatRateOther: event.target.value })) })} />)}
      {field("amountInWords", "AmountInWords", "Số tiền viết bằng chữ", value.profile !== "receipt", "API nhận chuỗi bạn gửi. Nút Điền theo Amount đọc số nguyên VND tại trình duyệt; hãy đối chiếu số tiền trước khi gửi.", <div className="amount-words-control">{input("amountInWords", 255)}<button type="button" className="subtle-button" disabled={value.currency !== "VND"} onClick={() => { try { update("amountInWords", amountInWordsVnd(totals.amount)); setWordError(""); } catch (error) { setWordError(error instanceof Error ? error.message : "Không đọc được số tiền."); } }}>Điền theo Amount</button>{wordError && <small role="alert">{wordError}</small>}</div>)}
      {field("listAttachNum", "ListAttachNum", "Số bảng kê", false, "Có thể cần cùng ngày bảng kê khi dữ liệu tiền âm/chiết khấu yêu cầu bảng kê.", input("listAttachNum"), true)}
      {field("listAttachDate", "ListAttachDate", "Ngày bảng kê", false, "Nhập trực tiếp; gửi XML theo dd/MM/yyyy.", <DateInput value={value.listAttachDate} onChange={(event) => update("listAttachDate", event.target.value)} />, true)}
    </div>

    <section className="import-products" id="invoice-field-products"><h3>Sản phẩm (<code>&lt;Product&gt;</code>)</h3>
      {value.products.map((product, index) => { const amounts = calculateProduct(product); const prefix = `products[${index}]`; return <section className="import-product" key={index}>
        <div className="import-section-heading"><h4>Sản phẩm {index + 1}</h4><button type="button" className="subtle-button" disabled={value.products.length === 1} aria-label={`Xóa sản phẩm ${index + 1}`} onClick={() => update("products", value.products.filter((_, i) => i !== index))}><Trash2 size={14} />Xóa</button></div>
        <div className="form-grid">
          {field(`${prefix}.no`, "No", "Số thứ tự", false, "Tự đánh số liên tục từ 1 theo vị trí dòng; thêm/xóa sản phẩm sẽ đánh lại số.", <input value={index + 1} readOnly />, true, index)}
          {field(`${prefix}.feature`, "Feature", "Loại sản phẩm", false, "1 hàng hóa; 2 khuyến mại; 3 chiết khấu; 4 ghi chú; 5 hàng hóa đặc trưng. Không gửi Feature: API tự suy loại dòng từ Amount.", <StyledSelect value={product.feature} onChange={(feature) => productUpdate(index, { feature, ...(feature !== "5" ? { extra: "" } : {}) })} options={[{ value: "", label: "Không gửi · API tự suy loại dòng" }, ...FEATURES.map(([feature, label]) => ({ value: feature, label: `${feature} · ${label}` }))]} />, true, index)}
          {field(`${prefix}.name`, "ProdName", "Tên sản phẩm", true, "Tên hàng hóa/dịch vụ, tối đa 500 ký tự.", <input value={product.name} maxLength={500} onChange={(event) => productUpdate(index, { name: event.target.value })} />, false, index)}
          {field(`${prefix}.totalOverride`, "Total", "Thành tiền (chưa thuế)", true, "Nhập thành tiền của dòng, chưa thuế, theo mẫu HTML.", <input type="number" step="any" value={product.totalOverride === "" ? amounts.total : product.totalOverride} onChange={(event) => productUpdate(index, { totalOverride: event.target.value })} />, false, index)}
          {field(`${prefix}.vatAmountOverride`, "VATAmount", "Tiền thuế dòng", false, "Gợi ý: Total × thuế suất / 100. Form gửi rõ số này; không dựa vào nhánh tự tính của API.", <input type="number" step="any" value={product.vatAmountOverride === "" ? amounts.vatAmount : product.vatAmountOverride} onChange={(event) => productUpdate(index, { vatAmountOverride: event.target.value })} />, true, index)}
          {field(`${prefix}.amountOverride`, "Amount", "Cộng (đã thuế)", true, "Gợi ý: Total + VATAmount. XSD yêu cầu Amount là số không rỗng.", <input type="number" step="any" value={product.amountOverride === "" ? amounts.amount : product.amountOverride} onChange={(event) => productUpdate(index, { amountOverride: event.target.value })} />, false, index)}
        </div>

        {product.feature === "5" && value.specialInvoice !== "0" && <div id={`invoice-field-${encodeURIComponent(`${prefix}.extra`)}`} className="product-special-extra" data-xml-tag="Extra" data-xml-scope="product" data-xml-index={index}><strong>Extra · Thông tin hàng hóa đặc trưng</strong><SpecialExtraFields reference type={value.specialInvoice} value={product.extra} onChange={(extra) => productUpdate(index, { extra })} /></div>}
      </section>; })}
      <button type="button" className="subtle-button" onClick={() => update("products", [...value.products, { ...initialInvoice.products[0], code: "", name: "", quantity: 1, price: 0, vat: value.vatRate, vatRateOther: value.vatRateOther, totalOverride: "", vatAmountOverride: "", amountOverride: "", extra: "" }])}><Plus size={14} />Thêm sản phẩm</button>
    </section>

    <details className="import-company-config import-config-disclosure">
      <summary><span><strong>Giả lập cấu hình công ty</strong><small>Loại dải hóa đơn và các tùy chọn mô phỏng</small></span><ChevronDown size={17} /></summary>
      <div className="import-config-body">
      <p>Các tùy chọn này là cấu hình riêng của công ty bạn (công ty tự bật trên hệ thống), không gửi trong request. Bật để xem sandbox phản ứng thế nào.</p>
      <label className="field" id="invoice-field-specialInvoice"><span>Loại dải hóa đơn (cấu hình của dải, không gửi trong request)</span><StyledSelect value={value.specialInvoice} onChange={(specialInvoice) => onChange({ ...value, specialInvoice, products: value.products.map((product) => product.feature === "5" ? { ...product, extra: "" } : product) })} options={[{ value: "0", label: "Dải thông thường" }, { value: "1", label: "Dải đặc thù: mua bán xe" }, { value: "2", label: "Dải đặc thù: dịch vụ vận chuyển" }, { value: "3", label: "Dải đặc thù: vận chuyển trên nền tảng TMĐT" }]} /></label>
      <label className="import-inline-check"><input type="checkbox" checked={simulation.notValidate} onChange={(event) => onSimulationChange({ ...simulation, notValidate: event.target.checked })} /><span>Công ty bật <code>NotValidateXmlData</code> (bỏ qua kiểm tra trường và sản phẩm; vẫn kiểm XSD, Ikey, chiết khấu, năm ký hiệu, thuế 8%)<small>Ví dụ: bỏ trống cả CusName lẫn Buyer để so sánh kết quả mô phỏng khi bật/tắt.</small></span></label>
      <label className="import-inline-check"><input type="checkbox" checked={simulation.skipVat8} onChange={(event) => onSimulationChange({ ...simulation, skipVat8: event.target.checked })} /><span>Công ty bật <code>SkipVat8=1</code> (bỏ qua kiểm thuế 8% theo thời hạn giảm thuế; chỉ áp dụng ký hiệu bắt đầu 1, 2, 5)<small>Ví dụ trong HTML: chọn thuế 8% và ngày năm 2027 để so sánh khi bật/tắt. Thời hạn thực tế phụ thuộc CheckVat8 trên server.</small></span></label>
      <p className="import-full-note">Các công tắc chỉ mô phỏng; không tự bật cấu hình trên Softdreams. Gửi thật vẫn được server kiểm tra dữ liệu. Thời hạn thuế 8% cần đối chiếu cấu hình công ty.</p>
      </div>
    </details>
    <section className="import-conditional-fields">
      <div className="import-section-heading"><h3>Thông tin bổ sung</h3></div>
      <div className="import-expand-card" data-open={showBuyer}>
      <label className="import-expand-toggle"><input type="checkbox" checked={showBuyer} disabled={car} aria-expanded={showBuyer} aria-controls="import-buyer-panel" onChange={(event) => { setExtraBuyer(event.target.checked); if (!event.target.checked) onChange({ ...value, identification: "", phone: "", provinceCode: "", provinceName: "", communeCode: "", communeName: "" }); }} /><UserRound size={19} className="import-expand-icon" /><span><strong>Thông tin người mua bổ sung</strong><small>CCCD, điện thoại, tỉnh/thành phố và xã/phường</small></span><em>{car ? "Dải mua bán xe" : "Tùy chọn"}</em><ChevronDown size={17} className="import-expand-chevron" /></label>
      {showBuyer && <div className="import-expand-body" id="import-buyer-panel"><p className="import-expand-hint">{car ? "Tự mở theo dải mua bán xe. Điền các trường có dấu *; CCCD là thông tin bổ sung." : "Chỉ điền khi cần bổ sung thông tin người mua."}</p><div className="form-grid">
        {([ ["identification", "CusIdentification", "CCCD"], ["phone", "CusPhone", "Điện thoại"], ["provinceCode", "ProvinceCode", "Mã tỉnh"], ["provinceName", "ProvinceName", "Tên tỉnh/thành phố"], ["communeCode", "CommuneCode", "Mã xã"], ["communeName", "CommuneName", "Tên xã/phường"] ] as const).map(([key, tag, label]) => field(key, tag, label, car && key !== "identification", key === "identification" ? "9 hoặc 12 chữ số." : "Bắt buộc khi cấu hình dải là mua bán xe.", input(key)))}
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
