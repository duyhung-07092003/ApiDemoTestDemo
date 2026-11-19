"use client";

import type { InputHTMLAttributes } from "react";

export function DateInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input {...props} type="date" onClick={(event) => {
    props.onClick?.(event);
    // Mở lịch khi bấm cả ô, vẫn cho nhập bằng bàn phím nếu browser không hỗ trợ.
    try { event.currentTarget.showPicker?.(); } catch { /* Native input remains usable. */ }
  }} />;
}
