"use client";

import { useRef, useState } from "react";
import { Braces, Check, ClipboardCheck, Copy } from "lucide-react";
import { validateXmlData, type XmlOptions, type XmlReport } from "@/lib/softdreams/validate-xml";
import { StyledSelect } from "./styled-select";
import { SOFTDREAMS_APIS } from "@/lib/softdreams/endpoints";

export function XmlValidator({ currentXml, currentContext }: { currentXml: string; currentContext: Pick<XmlOptions, "api" | "profile" | "specialInvoice" | "pattern" | "serial"> }) {
  const [source, setSource] = useState("");
  const [options, setOptions] = useState<XmlOptions>({ household: false, businessCustomer: false, specialGoods: false, ...currentContext });
  const configure = (next: Partial<XmlOptions>) => { setOptions((previous) => ({ ...previous, ...next })); setReport(null); setCopied(false); };
  const [report, setReport] = useState<XmlReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);
  const errors = report?.issues.filter((issue) => issue.level === "error").length ?? 0;
  const warnings = report?.issues.filter((issue) => issue.level === "warning").length ?? 0;
  const change = (value: string) => { setSource(value); setReport(null); setCopyError(""); setCopied(false); };
  return (
    <section className="response-card xml-validator" id="xml-validator" aria-labelledby="xml-validator-heading">
      <h3 className="xml-validator-summary" id="xml-validator-heading">
        <span className="xml-validator-icon"><ClipboardCheck size={20} /></span>
        <span>Kiểm tra dữ liệu hóa đơn<small>{options.api === "invoice" ? "importInvoice" : options.api} · {options.profile === "receipt" ? "Receipt" : options.profile?.toUpperCase()} · XML Validator</small></span>
        <span className="xml-validator-badge">Kiểm tra tại máy</span>
      </h3>
      <div className="xml-validator-content">
        <div className="form-grid">
          <label className="field"><span>API cần kiểm tra</span><StyledSelect value={options.api ?? "invoice"} onChange={(api) => configure({ api })} options={Object.entries(SOFTDREAMS_APIS).map(([value, api]) => ({ value, label: api.path }))} /></label>
          <label className="field"><span>Loại form / mẫu hóa đơn</span><StyledSelect value={options.profile ?? "tt78"} onChange={(profile) => configure({ profile, ...(profile === "receipt" ? { specialInvoice: "0", specialGoods: false } : {}) })} options={[{ value: "tt78", label: "TT78 · GTGT / bán hàng" }, { value: "receipt", label: "Biên lai · Receipt" }, { value: "legacy", label: "Mẫu cũ · chưa hỗ trợ" }, { value: "pit", label: "Chứng từ TNCN · chưa hỗ trợ" }]} /></label>
          <label className="field"><span>Hàng hóa đặc trưng của dải</span><StyledSelect value={options.specialInvoice ?? "0"} disabled={options.profile === "receipt"} onChange={(specialInvoice) => configure({ specialInvoice, specialGoods: specialInvoice === "1" })} options={[{ value: "0", label: "Thông thường" }, { value: "1", label: "1 · Mua bán xe" }, { value: "2", label: "2 · Dịch vụ vận chuyển" }, { value: "3", label: "3 · Vận chuyển trên TMĐT" }]} /></label>
          <label className="field"><span>Pattern · kiểm tra năm / MTT</span><input value={options.pattern ?? ""} onChange={(event) => configure({ pattern: event.target.value })} /></label>
          <label className="field"><span>Serial · ký hiệu dải</span><input value={options.serial ?? ""} onChange={(event) => configure({ serial: event.target.value })} /></label>
        </div>
        <p className="xml-validator-note">Dán request JSON: Pattern/Serial trong request được ưu tiên. Dán XML thuần: dùng cấu hình ở trên. Loại một/nhiều thuế suất dùng chung quy tắc đầu vào. Dải thực tế và cấu hình công ty cần được xác nhận trên Softdreams.</p>
        <p>Dán XML thuần hoặc cả request HTTP/JSON có trường XmlData để tìm thẻ thiếu, sai cấu trúc và chênh lệch số tiền. Chỉ kiểm tra trên trình duyệt.</p>
        <label htmlFor="xml-validation-source">XML hoặc request HTTP/JSON chứa XmlData</label>
        <textarea ref={editor} id="xml-validation-source" className="body-editor" spellCheck={false} value={source}
          onChange={(event) => change(event.target.value)} placeholder={"<Invoices>\n  <Inv>\n    <Invoice>...</Invoice>\n  </Inv>\n</Invoices>"} />
        <div className="xml-validation-options">
          {([
            ["household", "Bên bán HKD/CNKD"],
            ["businessCustomer", "Khách hàng doanh nghiệp"],
          ] as const).map(([key, label]) => (
            <label key={key} data-checked={options[key]}><input type="checkbox" checked={options[key]} onChange={(event) => {
              setOptions({ ...options, [key]: event.target.checked }); setReport(null); setCopied(false);
            }} />{label}</label>
          ))}
        </div>
        <div className="xml-validator-actions">
          <button type="button" className="send-button" onClick={() => { setReport(validateXmlData(source, options)); setCopied(false); }}>
            <ClipboardCheck size={15} />Kiểm tra XML
          </button>
          <button type="button" className="subtle-button" onClick={() => { change(currentXml); configure({ ...currentContext, specialGoods: currentContext.specialInvoice === "1" }); }}><Braces size={15} />Lấy XML & cấu hình từ form</button>
          <button type="button" className="subtle-button" onClick={() => change("")}>Xóa</button>
        </div>
        <p className="xml-validator-note">Chọn đúng loại nghiệp vụ để kiểm tra các trường bắt buộc có điều kiện. Chưa kiểm tra Ikey đã tồn tại, tài khoản, ký hiệu hóa đơn, danh mục mã và các quy tắc riêng trên Softdreams.</p>
        {report && <div className="xml-validation-report" aria-live="polite">
          {report.extractedFromRequest && <p className="xml-request-extracted">Đã đọc XmlData và Pattern/Serial từ request để kiểm tra. Nội dung gốc được giữ lại trong ô nhập.</p>}
          <div className={"xml-validation-status " + (errors ? "has-errors" : warnings ? "has-warnings" : "passed")}>
            <strong>{errors ? "Cần sửa lỗi XML" : warnings ? "Cần đối chiếu cảnh báo" : "Đạt các quy tắc đã kiểm tra"}</strong>
            <span>{report.invoices} hóa đơn · {errors} lỗi · {warnings} cảnh báo</span>
          </div>
          {!report.issues.length && <p>Chưa phát hiện lỗi trong bộ quy tắc hiện tại. Kết quả này không thay thế việc kiểm tra nghiệp vụ của API.</p>}
          <ol className="xml-issue-list">
            {report.issues.map((issue, index) => <li key={index} className={"xml-issue " + issue.level}>
              <span className="xml-issue-level">{issue.level === "error" ? "Lỗi" : "Cảnh báo"}</span>
              <code>{issue.path}</code>
              <strong>{issue.message}</strong>
              <p>Cách xử lý: {issue.suggestion}</p>
            </li>)}
          </ol>
          <button type="button" className="subtle-button" onClick={async () => {
            try {
              await navigator.clipboard.writeText([
                "Kiểm tra XML " + options.api + " / " + options.profile + ": " + errors + " lỗi, " + warnings + " cảnh báo",
                ...report.issues.map((issue) => "[" + issue.level + "] " + issue.path + "\n" + issue.message + "\nCách xử lý: " + issue.suggestion),
              ].join("\n\n"));
              setCopied(true); setCopyError("");
            } catch { setCopyError("Không sao chép được. Bạn có thể chọn nội dung kết quả để sao chép thủ công."); }
          }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Đã sao chép" : "Copy kết quả"}</button>
          {copyError && <p role="status">{copyError}</p>}
        </div>}
      </div>
    </section>
  );
}
