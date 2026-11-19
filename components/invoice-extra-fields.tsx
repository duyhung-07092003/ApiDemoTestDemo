"use client";

const EXTRA_KEYS = [
  ["PassportNo", "Số hộ chiếu · PassportNo"],
  ["MDVQHNSach", "Mã đơn vị quan hệ ngân sách · MDVQHNSach"],
  ["CheckDiscount", "Áp dụng giảm thuế bán hàng · CheckDiscount"],
] as const;

export function InvoiceExtraFields({ value, pattern, onChange }: { value: string; pattern: string; onChange: (value: string) => void }) {
  let values: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) values = parsed as Record<string, unknown>;
  } catch {
    values = {};
  }

  return <div className="extra-key-fields">
    <p>Nhập giá trị; các key JSON được tạo sẵn theo nghiệp vụ hóa đơn.</p>
    <div className="form-grid">
      {EXTRA_KEYS.filter(([key]) => key !== "CheckDiscount" || pattern.trim().startsWith("2")).map(([key, label]) => <label className="field" key={key}>
        <span>{label}</span>
        <input value={String(values[key] ?? "")} onChange={(event) => {
          const next = { ...values };
          if (event.target.value === "") delete next[key];
          else next[key] = event.target.value;
          onChange(Object.keys(next).length ? JSON.stringify(next, null, 2) : "");
        }} />
      </label>)}
    </div>
  </div>;
}
