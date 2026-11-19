"use client";

import { useRef, useState } from "react";
import { Braces, Check, ClipboardCheck, Copy } from "lucide-react";
import { validateXmlData, type XmlOptions, type XmlReport } from "@/lib/softdreams/validate-xml";

export function XmlValidator({ currentXml }: { currentXml: string }) {
  const [source, setSource] = useState("");
  const [options, setOptions] = useState<XmlOptions>({ household: false, businessCustomer: false, specialGoods: false });
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
        <span>Kiểm tra dữ liệu hóa đơn<small>importInvoice · XML Validator</small></span>
        <span className="xml-validator-badge">Kiểm tra tại máy</span>
      </h3>
      <div className="xml-validator-content">
        <p>Dán XML thuần hoặc cả request HTTP/JSON có trường XmlData để tìm thẻ thiếu, sai cấu trúc và chênh lệch số tiền. Chỉ kiểm tra trên trình duyệt.</p>
        <label htmlFor="xml-validation-source">XML hoặc request HTTP/JSON chứa XmlData</label>
        <textarea ref={editor} id="xml-validation-source" className="body-editor" spellCheck={false} value={source}
          onChange={(event) => change(event.target.value)} placeholder={"<Invoices>\n  <Inv>\n    <Invoice>...</Invoice>\n  </Inv>\n</Invoices>"} />
        <div className="xml-validation-options">
          {([
            ["household", "Bên bán HKD/CNKD"],
            ["businessCustomer", "Khách hàng doanh nghiệp"],
            ["specialGoods", "Hàng hóa đặc trưng loại 1"],
          ] as const).map(([key, label]) => (
            <label key={key} data-checked={options[key]}><input type="checkbox" checked={options[key]} onChange={(event) => {
              setOptions({ ...options, [key]: event.target.checked }); setReport(null); setCopied(false);
            }} />{label}</label>
          ))}
        </div>
        <div className="xml-validator-actions">
          <button type="button" className="send-button" onClick={() => { const nextReport = validateXmlData(source, options); if (nextReport.normalizedXml) setSource(nextReport.normalizedXml); setReport(nextReport); setCopied(false); }}>
            <ClipboardCheck size={15} />Kiểm tra XML
          </button>
          <button type="button" className="subtle-button" onClick={() => change(currentXml)}><Braces size={15} />Lấy XML từ form</button>
          <button type="button" className="subtle-button" onClick={() => change("")}>Xóa</button>
        </div>
        <p className="xml-validator-note">Chọn đúng loại nghiệp vụ để kiểm tra các trường bắt buộc có điều kiện. Chưa kiểm tra Ikey đã tồn tại, tài khoản, ký hiệu hóa đơn, danh mục mã và các quy tắc riêng trên Softdreams.</p>
        {report && <div className="xml-validation-report" aria-live="polite">
          {report.extractedFromRequest && <p className="xml-request-extracted">Đã tách XmlData khỏi request; ô nhập hiện hiển thị XML được kiểm tra.</p>}
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
                "Kiểm tra XML importInvoice: " + errors + " lỗi, " + warnings + " cảnh báo",
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
