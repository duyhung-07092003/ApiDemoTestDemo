"use client";

export function SpecialExtraFields({ type, value, onChange, reference = false }: { type: string; value: string; onChange: (value: string) => void; reference?: boolean }) {
  let obj: Record<string, unknown> = {};
  try { const parsed = JSON.parse(value || "{}"); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); obj = parsed; }
  catch { obj = {}; }
  let keys: readonly (readonly [string, string])[] = [];
  if (type === "1" && reference) keys = [
    ["SKhung", "Số khung *"], ["SMay", "Số máy *"], ["LTSan", "Loại tài sản (1 ô tô, 2 mô tô/xe máy) *"],
    ["TTTSan", "Tình trạng tài sản (0 hoặc 1) *"], ["XXu", "Xuất xứ (0 trong nước, 1 nhập khẩu) *"],
    ["SGCNATKThuat", "Số giấy chứng nhận chất lượng an toàn kỹ thuật và bảo vệ môi trường (xe nhập khẩu)"],
    ["SSPKTCLXXuong", "Số seri phiếu kiểm tra chất lượng xuất xưởng (xe trong nước)"],
    ["MNSXuat", "Mã nước sản xuất"], ["TLTSDKy", "Tên loại tài sản đăng ký"], ["NSXuat", "Năm sản xuất"],
    ["TTMai", "Tên thương mại"], ["TNHieu", "Tên nhãn hiệu"], ["KLXe", "Kiểu loại xe"],
    ["TTLVHCSuat", "Thể tích làm việc hoặc công suất"], ["TTai", "Trọng tải"], ["SCNgoi", "Số người cho phép chở"], ["SBKSoat", "Số biển kiểm soát"],
  ];
  else if (type === "1") keys = [
    ["SKhung", "Số khung *"], ["SMay", "Số máy *"], ["LTSan", "Loại tài sản (1/2; để trống nếu bản cũ)"],
    ["TTTSan", "Tình trạng tài sản (0/1)"], ["XXu", "Xuất xứ (0 trong nước / 1 nhập khẩu)"],
    ...(String(obj.XXu) === "0" ? [["SSPKTCLXXuong", "Số phiếu KTCL xuất xưởng *"]] as const : []),
    ...(String(obj.XXu) === "1" ? [["SGCNATKThuat", "Số GCN ATKT *"]] as const : []),
    ...(String(obj.TTTSan) === "1" ? [["MNSXuat", "Mã nước sản xuất *"], ["TLTSDKy", "Tài liệu đăng ký *"], ["NSXuat", "Năm sản xuất *"], ["TTMai", "TTMai *"], ["TNHieu", "Tên nhãn hiệu *"], ["KLXe", "Khối lượng xe *"], ["TTLVHCSuat", "TTLVHCSuat *"], ["TTai", "Tải trọng *"], ["SCNgoi", "Số chỗ ngồi *"], ["SBKSoat", "Biển kiểm soát *"]] as const : []),
  ];
  else if (type === "2") keys = [["BKSPTVChuyen", "Biển kiểm soát phương tiện *"]];
  else if (type === "3") keys = [["TNGHang", "Tên người gửi hàng *"], ["DCNGHang", "Địa chỉ người gửi *"], ["MSTNGHang", "MST người gửi *"], ["MDDNGHang", "Mã định danh người gửi *"]];
  return <div className="special-extra-fields">{keys.map(([key, label]) => { const required = label.endsWith(" *"); const text = required ? label.slice(0, -2) : label; return <label className="field" key={key}><span><span className="field-label-text">{text} · {key}</span>{required && <b className="required-star">*</b>}</span>
    <input data-extra-key={key} value={String(obj[key] ?? "")} onChange={(e) => {
      const next = { ...obj };
      if (e.target.value === "") delete next[key]; else next[key] = e.target.value;
      if (key === "XXu") {
        delete next.SSPKTCLXXuong;
        delete next.SGCNATKThuat;
      }
      if (key === "TTTSan" && e.target.value !== "1") {
        for (const vehicleKey of ["MNSXuat", "TLTSDKy", "NSXuat", "TTMai", "TNHieu", "KLXe", "TTLVHCSuat", "TTai", "SCNgoi", "SBKSoat"]) delete next[vehicleKey];
      }
      onChange(JSON.stringify(next));
    }} /></label>; })}</div>;
}
