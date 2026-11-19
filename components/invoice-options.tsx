"use client";

import type { InvoiceInput } from "@/lib/softdreams/invoice";
import { StyledSelect } from "./styled-select";
import { InvoiceExtraFields } from "./invoice-extra-fields";

type InvoiceIssue = { field: string; message: string };
const issueMessages = (issues: InvoiceIssue[], field: string) => issues.filter((issue) => issue.field === field).map((issue) => issue.message);
const issueId = (field: string) => `invoice-field-${encodeURIComponent(field)}`;
function FieldIssues({ messages }: { messages: string[] }) { return <>{messages.map((message, index) => <small className="field-validation-message" key={index}>{message}</small>)}</>; }

export function InvoiceOptions({ value, onChange, issues = [] }: { value: InvoiceInput; onChange: (value: InvoiceInput) => void; issues?: InvoiceIssue[] }) {
  const mtt = value.pattern.trim().toUpperCase()[4] === "M";
  const profileIssues = issueMessages(issues, "profile");
  const specialIssues = issueMessages(issues, "specialInvoice");
  const convertIssues = issueMessages(issues, "convert");
  return <section className="invoice-options">
    <h3>Loại mẫu & tùy chọn import</h3>
    <p>Các lựa chọn này dùng kiểm tra dữ liệu tại form; không thay đổi cấu hình dải trên Softdreams. Pattern/Serial phải trỏ đúng dải thật.</p>
    <div className="form-grid">
      <label id={issueId("profile")} className="field" data-invalid={profileIssues.length > 0 || undefined}><span>Bộ quy tắc của mẫu</span><StyledSelect value={value.profile} options={[{ value: "tt78", label: "TT78 · GTGT / bán hàng (C78InvoiceVAT)" }, { value: "receipt", label: "Biên lai · Receipt" }]} onChange={(profile) => {
        const receipt = profile === "receipt";
        onChange({ ...value, profile, ...(receipt ? { specialInvoice: "0", vatRate: -1, vatRateOther: "", currency: "VND", vatAmountOverride: "",
          products: value.products.map((p) => ({ ...p, vat: -1, vatRateOther: "", vatAmountOverride: "", feature: p.feature === "4" ? "4" : "1" })) } : {}) });
      }} /><FieldIssues messages={profileIssues} /></label>
      <label id={issueId("specialInvoice")} className="field" data-invalid={specialIssues.length > 0 || undefined}><span>Hàng hóa đặc trưng của dải</span><StyledSelect value={value.specialInvoice} disabled={value.profile === "receipt"} onChange={(specialInvoice) => onChange({ ...value, specialInvoice, ...(specialInvoice !== value.specialInvoice ? { products: value.products.map((product) => product.feature === "5" ? { ...product, extra: "" } : product) } : {}) })} options={[
        { value: "0", label: "Thông thường" }, { value: "1", label: "1 · Mua bán xe" },
        { value: "2", label: "2 · Dịch vụ vận chuyển" }, { value: "3", label: "3 · Vận chuyển trên TMĐT" },
      ]} /><FieldIssues messages={specialIssues} /></label>
      <label id={issueId("convert")} className="field" data-invalid={convertIssues.length > 0 || undefined}><span>Convert · Bảng mã dữ liệu</span><StyledSelect value={value.convert} onChange={(next) => onChange({ ...value, convert: Number(next) })} options={[
        { value: 0, label: "0 · Unicode (mặc định)" }, { value: 1, label: "1 · TCVN3 → Unicode trên API" },
      ]} /><FieldIssues messages={convertIssues} /></label>
    </div>
    <p>{mtt ? "Pattern MTT: form kiểm tra định dạng mã CQT; API xác nhận mã đã đăng ký cho dải và chưa dùng." : "Mẫu thường: không gửi TaxAuthorityCode."} Thuế 8%, danh mục tỉnh/xã, cấu hình miễn kiểm tra và cleaner chỉ xác minh được trên API.</p>
    <p>Form này hỗ trợ TT78 và biên lai. Mẫu cũ, chứng từ TNCN và phiếu xuất kho có cấu trúc riêng, không chọn thay bằng TT78.</p>
  </section>;
}

export function InvoiceAdvanced({ value, onChange, issues = [] }: { value: InvoiceInput; onChange: (value: InvoiceInput) => void; issues?: InvoiceIssue[] }) {
  const advancedXmlTags: Record<string, string> = {
    budgetaryRelationshipCode: "BudgetaryRelationshipCode", comAddress: "ComAddress", note: "Note", profileCode: "ProfileCode",
    payOrderOrgTaxCode: "PayOrderOrgTaxCode", payOrderOrgName: "PayOrderOrgName", payOrderOrgAddress: "PayOrderOrgAddress",
    discount: "Discount", taxFreeDeductions: "TaxFreeDeductions",
  };
  const feeXmlTags: Record<string, string> = { name: "Name", amount: "Amount", feeRate: "FeeRate", vatRate: "VATRate", vatRateOther: "VATRateOther", vatAmount: "VATAmount", totalCharge: "TotalCharge" };
  return <details className="invoice-options">
    <summary>Trường nâng cao & phí/lệ phí</summary>
    <div className="form-grid">
      <div className="invoice-extra-field" data-xml-tag="Extra" data-xml-scope="invoice"><strong>Extra hóa đơn · các key cố định</strong><InvoiceExtraFields value={value.extra} pattern={value.pattern} onChange={(extra) => onChange({ ...value, extra })} /></div>
      {([
        ["budgetaryRelationshipCode", "BudgetaryRelationshipCode · Mã quan hệ ngân sách"],
        ["comAddress", "ComAddress · Địa chỉ bên bán"], ["note", "Note · Ghi chú"],
        ["profileCode", "ProfileCode"], ["payOrderOrgTaxCode", "PayOrderOrgTaxCode · MST đơn vị ủy nhiệm"],
        ["payOrderOrgName", "PayOrderOrgName · Tên đơn vị ủy nhiệm"], ["payOrderOrgAddress", "PayOrderOrgAddress · Địa chỉ đơn vị ủy nhiệm"],
        ["discount", "Discount · Tỷ lệ chiết khấu chung"], ["taxFreeDeductions", "TaxFreeDeductions · Khoản giảm trừ"],
      ] as const).map(([key, label]) => <label className="field" key={key} data-xml-tag={advancedXmlTags[key]} data-xml-scope="invoice"><span>{label}</span>
        <input value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} /></label>)}
      {value.pattern.trim().toUpperCase()[4] === "M" && <label id={issueId("taxAuthorityCode")} className="field" data-invalid={issueMessages(issues, "taxAuthorityCode").length > 0 || undefined} data-xml-tag="TaxAuthorityCode" data-xml-scope="invoice"><span>TaxAuthorityCode · Mã CQT MTT (tùy chọn)</span>
        <input value={value.taxAuthorityCode} onChange={(e) => onChange({ ...value, taxAuthorityCode: e.target.value })} /><FieldIssues messages={issueMessages(issues, "taxAuthorityCode")} /></label>}
    </div>
    <h4>InvoiceFees · Phí/lệ phí (tùy chọn)</h4>
    {value.fees.map((fee, i) => <div className="form-grid invoice-fee-row" key={i}>
      {([["name", "Name · Tên phí *"], ["amount", "Amount · Số tiền *"], ["feeRate", "FeeRate"], ["vatRate", "VATRate"], ["vatRateOther", "VATRateOther"], ["vatAmount", "VATAmount"], ["totalCharge", "TotalCharge"]] as const).map(([key, label]) =>
        <label className="field" key={key} data-xml-tag={feeXmlTags[key]} data-xml-scope="fee" data-xml-index={i}><span>{label}</span><input value={fee[key]} maxLength={key === "name" ? 100 : undefined} onChange={(e) => onChange({ ...value, fees: value.fees.map((row, index) => index === i ? { ...row, [key]: e.target.value } : row) })} /></label>)}
      <button type="button" className="subtle-button" onClick={() => onChange({ ...value, fees: value.fees.filter((_, index) => index !== i) })}>Xóa phí</button>
    </div>)}
    <button type="button" className="subtle-button" onClick={() => onChange({ ...value, fees: [...value.fees, { name: "", amount: "", feeRate: "", vatRate: "", vatRateOther: "", vatAmount: "", totalCharge: "" }] })}>Thêm phí/lệ phí</button>
  </details>;
}
