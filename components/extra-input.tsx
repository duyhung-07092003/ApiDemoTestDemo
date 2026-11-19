"use client";

import { normalizeExtra } from "@/lib/softdreams/invoice";

export function ExtraInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  let invalidJson = false;
  if (value.trim().startsWith("{")) {
    try { JSON.parse(value); } catch { invalidJson = true; }
  }
  return <div className="extra-editor">
    <textarea value={value} onChange={(event) => onChange(event.target.value)}
      placeholder={'{"ghiChu":"Nội dung"} hoặc ghi chú văn bản'} rows={3} />
    <button type="button" className="subtle-button" onClick={() => {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          onChange(JSON.stringify(parsed, null, 2));
          return;
        }
      } catch { /* Convert plain text into a JSON object. */ }
      onChange(JSON.stringify({ ghiChu: value }, null, 2));
    }}>Định dạng / chuyển thành JSON</button>
    {invalidJson ? <small role="status">JSON chưa hợp lệ; bấm chuyển thành JSON để giữ nội dung trong ghiChu.</small>
      : <small>Gửi dưới dạng chuỗi: {normalizeExtra(value) || "(trống)"}</small>}
  </div>;
}
