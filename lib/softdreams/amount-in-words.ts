const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
function readGroup(value: number, full: boolean) {
  const hundred = Math.floor(value / 100), ten = Math.floor(value / 10) % 10, unit = value % 10;
  const words: string[] = [];
  if (hundred || full) words.push(digits[hundred], "trăm");
  if (ten > 1) words.push(digits[ten], "mươi");
  else if (ten === 1) words.push("mười");
  else if (unit && (hundred || full)) words.push("lẻ");
  if (unit) words.push(unit === 1 && ten > 1 ? "mốt" : unit === 5 && ten > 0 ? "lăm" : digits[unit]);
  return words.join(" ");
}
export function amountInWordsVnd(value: number): string {
  if (!Number.isSafeInteger(value)) throw new Error("Đọc số VND cần số nguyên trong giới hạn an toàn. Hãy nhập chữ trực tiếp nếu có phần thập phân.");
  if (!value) return "Không đồng chẵn";
  const groups: number[] = [];
  let remaining = Math.abs(value);
  while (remaining) { groups.push(remaining % 1000); remaining = Math.floor(remaining / 1000); }
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) if (groups[i]) words.push(readGroup(groups[i], i < groups.length - 1 && groups[i] < 100), units[i]);
  const result = `${value < 0 ? "âm " : ""}${words.filter(Boolean).join(" ")} đồng chẵn`;
  return result[0].toUpperCase() + result.slice(1);
}
