"use client";

import { useState, type ReactNode } from "react";
import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { calculateInvoice, calculateProduct, initialInvoice, VAT_RATES, FEATURES, type InvoiceInput } from "@/lib/softdreams/invoice";
import { amountInWordsVnd } from "@/lib/softdreams/amount-in-words";
import { InvoiceOptions, InvoiceAdvanced } from "./invoice-options";
import { SpecialExtraFields } from "./special-extra-fields";
import { DateInput } from "./date-input";
import { StyledSelect } from "./styled-select";
import type { CompanySimulation } from "@/lib/softdreams/company-preview";
import type { XmlSelection } from "@/lib/softdreams/xml-selection";
import { invoiceFieldExplanation } from "@/lib/softdreams/invoice-field-explanation";

type Issue = { field: string; message: string };
type InvoiceTextKey = { [K in keyof InvoiceInput]: InvoiceInput[K] extends string ? K : never }[keyof InvoiceInput];
const currencies = ["VND – đồng", "USD – đô la Mỹ", "EUR – Euro", "JPY – Yên", "GBP – bảng Anh", "SGD – đô la Singapore", "MYR – Ringgit Malaysia", "HKD – đô la Hồng Kông", "KRW – Won", "AUD – đô la Úc", "NOK – Krone Na Uy"];

export function ImportInvoiceForm({ value, onChange, issues, mode, onModeChange, simulation, onSimulationChange, explanation, onCloseExplanation }: {
  value: InvoiceInput; onChange: (value: InvoiceInput) => void; issues: Issue[];
  mode: "single" | "multi"; onModeChange: (mode: "single" | "multi") => void;
  simulation: CompanySimulation; onSimulationChange: (value: CompanySimulation) => void;
  explanation: XmlSelection | null; onCloseExplanation: () => void;
}) {
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [location, setLocation] = useState(false);
  const [wordError, setWordError] = useState("");
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const totals = calculateInvoice(value);
  const car = value.specialInvoice === "1";
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
    return <label key={key} id={`invoice-field-${encodeURIComponent(key)}`} className="field" data-request-selected={selected || undefined} data-invalid={messages.length > 0 || undefined} data-xml-tag={tag} data-xml-scope={index === undefined ? "invoice" : "product"} data-xml-index={index}>
      <span><span className="field-label-text"><code>{tag}</code> · {label}</span>{required && <b className="required-star">*</b>}<button type="button" className="import-help-toggle" aria-label={`Giải thích ${tag}`} aria-expanded={openHelp === key} aria-controls={helpId} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpenHelp(openHelp === key ? null : key); }}><CircleHelp size={14} /></button></span>
      {control}{(messages.length > 0 || openHelp === key) && <div className="field-validation-messages">{openHelp === key && <div id={helpId} className="import-field-help"><strong>{tag} · {label}</strong><p>{help}</p></div>}{messages.map((message, i) => <small className="field-validation-message" key={i}>{message.message}</small>)}</div>}
    </label>;
  }
  const input = (key: InvoiceTextKey, maxLength?: number) => <input value={value[key]} maxLength={maxLength} onChange={(event) => update(key, event.target.value)} />;
  return <div className="import-content-form">
    {selectedExplanation && <aside className="import-formula" role="status"><button type="button" className="subtle-button" aria-label="Đóng giải thích" onClick={onCloseExplanation}>×</button><strong>{selectedExplanation.field} · {selectedExplanation.where}</strong><p className="import-formula-expression">{selectedExplanation.formula}</p><p>Đang nhập: <b>{format(selectedExplanation.actual)}</b>{selectedExplanation.expected !== undefined && <> · Đối chiếu: <b>{format(selectedExplanation.expected)}</b></>}</p>{selectedExplanation.matches !== undefined && <p className={selectedExplanation.matches ? "formula-matches" : "formula-differs"}>{selectedExplanation.matches ? "Khớp công thức gợi ý" : "Lệch so với công thức gợi ý · kiểm tra lại chứng từ"}</p>}<p>{selectedExplanation.note}</p></aside>}
    <section className="import-tax-description">
      <div className="import-section-heading"><h3>Kiểu mẫu: {mode === "single" ? "một thuế suất" : "nhiều thuế suất"}</h3><StyledSelect value={mode} onChange={(next) => {
        onModeChange(next as "single" | "multi");
        if (next === "single") update("products", value.products.map((row) => ({ ...row, vat: value.vatRate, vatRateOther: value.vatRateOther })));
      }} options={[{ value: "single", label: "Mẫu 1 · Một thuế suất" }, { value: "multi", label: "Nhiều thuế suất" }]} /></div>
      <p>Một thuế suất: khai VATRate ở hóa đơn; dòng không khai thuế suất thì API kế thừa từ hóa đơn. API chỉ tự tính VATAmount dòng khi không gửi Feature, không gửi VATAmount và kế thừa thuế suất hóa đơn.</p>
      <p>Form này tính gợi ý tại máy và gửi rõ các số tiền, thuế suất đang hiển thị. Có thể nhập riêng số tiền theo chứng từ; công thức gợi ý không thay thế quy tắc API.</p>
    </section>
    <div className="import-section-heading"><h3>Hóa đơn (<code>&lt;Invoice&gt;</code>)</h3></div>
    <label className="import-inline-check"><input type="checkbox" checked={requiredOnly} onChange={(event) => setRequiredOnly(event.target.checked)} />Chỉ hiện các trường bắt buộc (ẩn ô tùy chọn cho gọn)</label>
    <div className="form-grid import-invoice-grid">
      {field("ikey", "Ikey", "Khóa tích hợp", true, "Khóa duy nhất của mỗi hóa đơn. Không trùng với hóa đơn khác trong gói hoặc hóa đơn đã có trên Softdreams.", input("ikey"))}
      {field("payment", "PaymentMethod", "Hình thức thanh toán", true, "Nhập trực tiếp, tối đa 50 ký tự. Có thể chọn một hình thức thường dùng.", <><input list="import-payment-methods" maxLength={50} value={value.payment} onChange={(event) => update("payment", event.target.value)} /><datalist id="import-payment-methods">{["Tiền mặt", "Chuyển khoản", "Tiền mặt/Chuyển khoản", "Đối trừ công nợ", "Không thu tiền"].map((item) => <option key={item} value={item} />)}</datalist></>)}
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
        const rate = Number(next); onChange({ ...value, vatRate: rate, ...(mode === "single" ? { products: value.products.map((row) => ({ ...row, vat: rate, vatRateOther: value.vatRateOther })) } : {}) });
      }} options={VAT_RATES.map(([rate, label]) => ({ value: rate, label: `${rate} · ${label}` }))} />)}
      {field("amountOverride", "Amount", "Tổng tiền thanh toán", true, "Gợi ý: Total + VATAmount hoặc tổng Amount dòng. Giá trị nhập riêng được ưu tiên.", <input type="number" step="any" value={value.amountOverride === "" ? totals.amount : value.amountOverride} onChange={(event) => update("amountOverride", event.target.value)} />)}
      {value.vatRate === -3 && field("vatRateOther", "VATRateOther", "Thuế suất khác (%)", true, "Giá trị từ 0 đến 99.99, tối đa 2 chữ số thập phân.", <input type="number" step="0.01" min="0" max="99.99" value={value.vatRateOther} onChange={(event) => onChange({ ...value, vatRateOther: event.target.value, ...(mode === "single" ? { products: value.products.map((row) => ({ ...row, vatRateOther: event.target.value })) } : {}) })} />)}
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
          {field(`${prefix}.totalOverride`, "Total", "Thành tiền (chưa thuế)", false, "Nhập riêng hoặc gợi ý SL × đơn giá − DiscountAmount. Total dòng là trường tùy chọn theo tài liệu API.", <input type="number" step="any" value={product.totalOverride === "" ? amounts.total : product.totalOverride} onChange={(event) => productUpdate(index, { totalOverride: event.target.value })} />, false, index)}
          {field(`${prefix}.vatAmountOverride`, "VATAmount", "Tiền thuế dòng", false, "Gợi ý: Total × thuế suất / 100. Form gửi rõ số này; không dựa vào nhánh tự tính của API.", <input type="number" step="any" value={product.vatAmountOverride === "" ? amounts.vatAmount : product.vatAmountOverride} onChange={(event) => productUpdate(index, { vatAmountOverride: event.target.value })} />, true, index)}
          {field(`${prefix}.amountOverride`, "Amount", "Cộng (đã thuế)", true, "Gợi ý: Total + VATAmount. XSD yêu cầu Amount là số không rỗng.", <input type="number" step="any" value={product.amountOverride === "" ? amounts.amount : product.amountOverride} onChange={(event) => productUpdate(index, { amountOverride: event.target.value })} />, false, index)}
          {mode === "multi" && field(`${prefix}.vatRate`, "VATRate", "Thuế suất dòng", true, "Chọn riêng thuế suất cho dòng hàng này.", <StyledSelect value={product.vat} onChange={(vat) => productUpdate(index, { vat: Number(vat) })} options={VAT_RATES.map(([vat, label]) => ({ value: vat, label: `${vat} · ${label}` }))} />, false, index)}
          {mode === "multi" && product.vat === -3 && field(`${prefix}.vatRateOther`, "VATRateOther", "Thuế suất khác", true, "Bắt buộc với thuế -3.", <input type="number" step="0.01" value={product.vatRateOther} onChange={(event) => productUpdate(index, { vatRateOther: event.target.value })} />, false, index)}
        </div>
        <details className="import-optional" open={issues.some((issue) => issue.field.startsWith(prefix) && ["code", "unit", "quantity", "price", "discount", "discountAmount"].some((key) => issue.field.endsWith(`.${key}`))) || undefined}><summary>Thông tin sản phẩm bổ sung · mã, đơn vị, số lượng, đơn giá, chiết khấu</summary><div className="form-grid">{([
          ["code", "Code", "Mã sản phẩm"], ["unit", "ProdUnit", "Đơn vị tính"], ["quantity", "ProdQuantity", "Số lượng"], ["price", "ProdPrice", "Đơn giá"], ["discountAmount", "DiscountAmount", "Tiền chiết khấu"], ["discount", "Discount", "Tỷ lệ chiết khấu (%)"],
        ] as const).map(([key, tag, label]) => field(`${prefix}.${key}`, tag, label, false, key === "discount" ? "Tỷ lệ không vượt 100%. Không tự thay thế DiscountAmount." : "Tùy chọn. Số lượng và đơn giá dùng để tính gợi ý; API không kiểm tra SL × đơn giá khớp Total.", <input type={typeof product[key] === "number" ? "number" : "text"} step="any" value={product[key]} onChange={(event) => productUpdate(index, { [key]: typeof product[key] === "number" ? Number(event.target.value) : event.target.value })} />, false, index))}</div></details>
        {product.feature === "5" && value.specialInvoice !== "0" && <div className="product-special-extra" data-xml-tag="Extra" data-xml-scope="product" data-xml-index={index}><strong>Extra · Thông tin hàng hóa đặc trưng</strong><SpecialExtraFields type={value.specialInvoice} value={product.extra} onChange={(extra) => productUpdate(index, { extra })} /></div>}
      </section>; })}
      <button type="button" className="subtle-button" onClick={() => update("products", [...value.products, { ...initialInvoice.products[0], code: "", name: "", quantity: 1, price: 0, vat: value.vatRate, vatRateOther: value.vatRateOther, totalOverride: "", vatAmountOverride: "", amountOverride: "", extra: "" }])}><Plus size={14} />Thêm sản phẩm</button>
    </section>

    <details className="import-optional"><summary>Giả lập cấu hình công ty & cấu hình mẫu</summary>
      <p>Loại dải và bộ quy tắc bên dưới dùng kiểm tra theo mẫu. Hai công tắc mô phỏng chỉ ảnh hưởng kết quả giả lập, không gửi trong request và không đổi cấu hình Softdreams.</p>
      <InvoiceOptions value={value} onChange={onChange} issues={issues} />
      <label className="import-inline-check"><input type="checkbox" checked={simulation.notValidate} onChange={(event) => onSimulationChange({ ...simulation, notValidate: event.target.checked })} />Mô phỏng NotValidateXmlData = 1</label><p>Bỏ qua một số kiểm tra trường theo bộ quy tắc mô phỏng; vẫn cần kiểm tra XSD, Ikey, chiết khấu, năm ký hiệu và thuế 8%. Gửi thật vẫn được server kiểm tra dữ liệu.</p>
      <label className="import-inline-check"><input type="checkbox" checked={simulation.skipVat8} onChange={(event) => onSimulationChange({ ...simulation, skipVat8: event.target.checked })} />Mô phỏng SkipVat8 = 1</label>
      <p>Khoảng ngày CheckVat8 phụ thuộc cấu hình hệ thống. Nhập khoảng ngày giả lập bên dưới để đối chiếu thuế 8%; đây không phải xác nhận thời hạn thuế từ API.</p>
      <div className="form-grid"><label className="field"><span>Thời hạn giả lập · từ ngày</span><DateInput value={simulation.from} onChange={(event) => onSimulationChange({ ...simulation, from: event.target.value })} /></label><label className="field"><span>Thời hạn giả lập · đến ngày</span><DateInput value={simulation.to} onChange={(event) => onSimulationChange({ ...simulation, to: event.target.value })} /></label></div>
    </details>
    <details className="import-optional" open={car || undefined}><summary>Bắt buộc theo điều kiện · thông tin bổ sung người mua</summary><p>CCCD là thông tin bổ sung; dải mua bán xe yêu cầu tên, địa chỉ, điện thoại, mã số thuế và tỉnh/xã theo tài liệu hiện tại.</p><div className="form-grid">
      {([ ["identification", "CusIdentification", "CCCD"], ["phone", "CusPhone", "Điện thoại"], ["provinceCode", "ProvinceCode", "Mã tỉnh"], ["provinceName", "ProvinceName", "Tên tỉnh"], ["communeCode", "CommuneCode", "Mã xã/phường"], ["communeName", "CommuneName", "Tên xã/phường"] ] as const).map(([key, tag, label]) => field(key, tag, label, car && key !== "identification", key === "identification" ? "9 hoặc 12 chữ số; không tự suy CCCD là bắt buộc cho mọi dải mua bán xe." : "Bắt buộc khi cấu hình dải là mua bán xe.", input(key)))}
    </div></details>
    <details className="import-optional" open={location || !!value.locationCode || !!value.locationName || !!value.locationAddress || undefined}><summary>Địa điểm kinh doanh · 3 trường tùy chọn</summary><label className="import-inline-check"><input type="checkbox" checked={location || !!value.locationCode || !!value.locationName || !!value.locationAddress} onChange={(event) => { setLocation(event.target.checked); if (!event.target.checked) onChange({ ...value, locationCode: "", locationName: "", locationAddress: "" }); }} />Gửi địa điểm kinh doanh</label><p>Cả ba trống: API có thể tự điền nếu công ty đã cấu hình. Không tự suy địa điểm từ form.</p>{(location || value.locationCode || value.locationName || value.locationAddress) && <div className="form-grid">{([ ["locationCode", "LocationCode", "Mã địa điểm kinh doanh"], ["locationName", "LocationName", "Tên địa điểm kinh doanh"], ["locationAddress", "LocationAddress", "Địa chỉ địa điểm kinh doanh"] ] as const).map(([key, tag, label]) => field(key, tag, label, false, key === "locationCode" ? "Tối đa 5 ký tự." : "Tối đa 400 ký tự. LocationName chỉ được lưu khi có LocationCode.", input(key)))}</div>}</details>
    <details className="import-optional"><summary>Thông tin hóa đơn tùy chọn · ngân hàng, email, cửa hàng và chiết khấu</summary><div className="form-grid">{([
      ["fkey", "Fkey", "Khóa tham chiếu"], ["customerCode", "CusCode", "Mã khách hàng"], ["bankName", "CusBankName", "Ngân hàng"], ["bankNo", "CusBankNo", "Số tài khoản"], ["email", "Email", "Email nhận thông báo"], ["customerEmails", "CusEmails", "Danh sách email"], ["emailCC", "EmailCC", "Email CC"], ["passportNo", "PassportNo", "Hộ chiếu"], ["storeCode", "StoreCode", "Mã cửa hàng"], ["storeName", "StoreName", "Tên cửa hàng"],
    ] as const).map(([key, tag, label]) => field(key, tag, label, false, "Trường tùy chọn. Không nhập thì giữ rỗng; kiểm tra độ dài và định dạng trước khi gửi.", input(key)))}
      {field("discountAmount", "DiscountAmount", "Tổng chiết khấu", false, "Nhập trực tiếp. Không tự đổi Total/Amount đã nhập riêng.", <input type="number" step="any" value={value.discountAmount} onChange={(event) => update("discountAmount", Number(event.target.value))} />)}
    </div></details>
    <InvoiceAdvanced value={value} onChange={onChange} issues={issues} />
    <p className="import-full-note">Không có ô nhập CusForeignOrgId, NationalityCode, CusNationality hoặc BusinessProdGroupCode: các thẻ này không thuộc XSD TT78 theo tài liệu tích hợp hiện tại.</p>
  </div>;
}
