export function specialProductIssues(type: string, feature: string, extra: string): string[] {
  const issues: string[] = [];
  let obj: Record<string, unknown> | null = null;
  try { const parsed = JSON.parse(extra); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) obj = parsed; } catch { /* Văn bản hợp lệ với dòng thường. */ }
  const carKeys = ["SKhung", "SMay", "LTSan", "TTTSan", "XXu", "SSPKTCLXXuong", "SGCNATKThuat", "MNSXuat", "TLTSDKy", "NSXuat", "TTMai", "TNHieu", "KLXe", "TTLVHCSuat", "TTai", "SCNgoi", "SBKSoat"];
  const transport = ["BKSPTVChuyen"];
  const ecommerce = ["TNGHang", "DCNGHang", "MSTNGHang", "MDDNGHang"];
  if (obj && [...carKeys, ...transport, ...ecommerce].some((key) => Object.hasOwn(obj!, key)) && (type === "0" || feature !== "5")) issues.push("Extra có key đặc trưng nhưng Feature/loại dải không phù hợp.");
  if (feature !== "5") return issues;
  if (type === "0") return [...issues, "Feature 5 chỉ dùng trên dải hàng hóa đặc trưng."];
  if (!obj) return [...issues, "Extra đặc trưng phải là JSON object có dữ liệu."];
  const data = obj;
  const required = (key: string, max: number) => {
    const value = String(data[key] ?? "").trim();
    if (!value || value.length > max) issues.push("Extra." + key + " bắt buộc, tối đa " + max + " ký tự.");
  };
  const allowed = type === "1" ? carKeys : type === "2" ? transport : ecommerce;
  if (Object.keys(data).some((key) => !allowed.includes(key))) issues.push("Extra chỉ chứa key đúng loại hàng hóa đặc trưng của dải.");
  if (type === "1") {
    required("SKhung", 50); required("SMay", 50);
    if (["LTSan", "TTTSan", "XXu"].some((key) => Object.hasOwn(data, key))) {
      if (!["1", "2"].includes(String(data.LTSan))) issues.push("Extra.LTSan cần 1 hoặc 2.");
      for (const key of ["TTTSan", "XXu"]) if (!["0", "1"].includes(String(data[key]))) issues.push("Extra." + key + " cần 0 hoặc 1.");
      if (String(data.XXu) === "0") required("SSPKTCLXXuong", 200);
      if (String(data.XXu) === "1") required("SGCNATKThuat", 200);
      if (String(data.TTTSan) === "1") {
        for (const [key, max] of [["MNSXuat", 2], ["TLTSDKy", 200], ["TTMai", 300], ["TNHieu", 200], ["KLXe", 50], ["TTLVHCSuat", 10], ["SBKSoat", 20]] as const) required(key, max);
        if (!/^\d{4}$/.test(String(data.NSXuat)) || Number(data.NSXuat) < 1901 || Number(data.NSXuat) > new Date().getFullYear() + 1) issues.push("Extra.NSXuat từ 1901 đến năm hiện tại + 1.");
        if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(String(data.TTai))) issues.push("Extra.TTai tối đa 7 số nguyên và 2 số thập phân.");
        if (!/^\d{1,4}$/.test(String(data.SCNgoi))) issues.push("Extra.SCNgoi cần 1–4 chữ số.");
      }
    }
  } else if (type === "2") required("BKSPTVChuyen", 200);
  else ecommerce.forEach((key) => required(key, 200));
  return issues;
}
