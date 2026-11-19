"use client";

export function SpecialExtraFields({ type, value, onChange }: { type: string; value: string; onChange: (value: string) => void }) {
  let obj: Record<string, unknown> = {};
  try { const parsed = JSON.parse(value || "{}"); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); obj = parsed; }
  catch { return <p className="invoice-rule-note">Extra cần là JSON object hợp lệ để dùng các ô nhập đặc trưng bên dưới.</p>; }
  let keys: readonly (readonly [string, string])[] = [];
  if (type === "1") keys = [
    ["SKhung", "Số khung *"], ["SMay", "Số máy *"], ["LTSan", "Loại tài sản (1/2; để trống nếu bản cũ)"],
    ["TTTSan", "Tình trạng tài sản (0/1)"], ["XXu", "Xuất xứ (0 trong nước / 1 nhập khẩu)"],
    ...(String(obj.XXu) === "0" ? [["SSPKTCLXXuong", "Số phiếu KTCL xuất xưởng *"]] as const : []),
    ...(String(obj.XXu) === "1" ? [["SGCNATKThuat", "Số GCN ATKT *"]] as const : []),
    ...(String(obj.TTTSan) === "1" ? [["MNSXuat", "Mã nước sản xuất *"], ["TLTSDKy", "Tài liệu đăng ký *"], ["NSXuat", "Năm sản xuất *"], ["TTMai", "TTMai *"], ["TNHieu", "Tên nhãn hiệu *"], ["KLXe", "Khối lượng xe *"], ["TTLVHCSuat", "TTLVHCSuat *"], ["TTai", "Tải trọng *"], ["SCNgoi", "Số chỗ ngồi *"], ["SBKSoat", "Biển kiểm soát *"]] as const : []),
  ];
  else if (type === "2") keys = [["BKSPTVChuyen", "Biển kiểm soát phương tiện *"]];
  else if (type === "3") keys = [["TNGHang", "Tên người gửi hàng *"], ["DCNGHang", "Địa chỉ người gửi *"], ["MSTNGHang", "MST người gửi *"], ["MDDNGHang", "Mã định danh người gửi *"]];
  return <div className="special-extra-fields">{keys.map(([key, label]) => <label className="field" key={key}><span>{label} · {key}</span>
    <input value={String(obj[key] ?? "")} onChange={(e) => {
      const next = { ...obj };
      if (e.target.value === "") delete next[key]; else next[key] = e.target.value;
      onChange(JSON.stringify(next, null, 2));
    }} /></label>)}</div>;
}
