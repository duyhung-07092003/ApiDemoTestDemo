"use client";

import { useState } from "react";
import { CircleAlert, ArrowUpRight, X } from "lucide-react";

type Issue = { field: string; message: string };
export type InvoiceIssueGroup = { index: number; customer: string; issues: Issue[] };

export function InvoiceIssuesPopup({ groups, selectedIndex, onSelectIssue }: {
  groups: InvoiceIssueGroup[];
  selectedIndex: number;
  onSelectIssue: (invoiceIndex: number, issue: Issue) => void;
}) {
  const [dismissedSignature, setDismissedSignature] = useState("");
  const invalid = groups.filter((group) => group.issues.length);
  const count = invalid.reduce((sum, group) => sum + group.issues.length, 0);
  if (!count) return null;
  const signature = invalid.map((group) => `${group.index}:${group.issues.map((issue) => `${issue.field}:${issue.message}`).join("|")}`).join(";");
  if (dismissedSignature === signature) return <button type="button" className="invoice-issues-popup-collapsed" aria-label={`Mở lại ${count} lỗi hóa đơn`} title={`Mở lại danh sách ${count} lỗi`} onClick={() => setDismissedSignature("")}><CircleAlert size={24} aria-hidden="true" /><span>{count > 99 ? "99+" : count}</span></button>;
  const next = invalid.find((group) => group.index === selectedIndex) ?? invalid[0];
  return <aside className="invoice-issues-popup" aria-labelledby="invoice-issues-popup-title">
    <header className="invoice-issues-popup-heading"><CircleAlert size={22} aria-hidden="true" /><div><h3 id="invoice-issues-popup-title">Cần sửa thông tin hóa đơn</h3><p role="status" aria-live="polite">{count} lỗi · {invalid.length} hóa đơn cần kiểm tra</p></div><button type="button" className="invoice-issues-popup-dismiss" aria-label="Thu gọn thông báo lỗi" title="Thu gọn" onClick={() => setDismissedSignature(signature)}><X size={17} aria-hidden="true" /></button></header>
    <p className="invoice-issues-popup-note">Bấm vào lỗi để đến đúng ô nhập. Dùng × để thu gọn thành nút tròn hiển thị số lỗi.</p>
    <div className="invoice-issues-popup-list">
      {invalid.map((group) => <section key={group.index} data-current={group.index === selectedIndex || undefined}>
        <h4>Hóa đơn {group.index + 1}<span>{group.customer || "Chưa nhập khách hàng"}</span></h4>
        <ul>{group.issues.map((issue, index) => <li key={`${issue.field}-${index}`}><button type="button" onClick={() => onSelectIssue(group.index, issue)}><span><code>{issue.field}</code><span>{issue.message}</span></span><ArrowUpRight size={15} aria-hidden="true" /></button></li>)}</ul>
      </section>)}
    </div>
    <footer><span>Chưa thể gửi gói khi còn lỗi</span><button type="button" onClick={() => onSelectIssue(next.index, next.issues[0])}>Đến lỗi cần sửa <ArrowUpRight size={14} aria-hidden="true" /></button></footer>
  </aside>;
}
