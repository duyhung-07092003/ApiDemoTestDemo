"use client";

import { useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { StyledSelect } from "./styled-select";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
};
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00");
  return Number.isFinite(date.getTime()) && isoDate(date) === value ? date : null;
};

export function DateInput({ value = "", onChange, disabled, readOnly, min, max, id, name, required, placeholder, className, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseDate(value) ?? new Date());
  const generatedId = useId();
  const calendar = useRef<HTMLDivElement>(null);
  const today = isoDate(new Date());
  const enabled = (day: string) => (!min || day >= String(min)) && (!max || day <= String(max));
  const select = (day: string) => {
    if (day && !enabled(day)) return;
    onChange?.({ target: { value: day } });
    setOpen(false);
  };
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  start.setDate(1 - (start.getDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  const move = (amount: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1, 12));
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -(date.getDay() + 6) % 7, End: 6 - (date.getDay() + 6) % 7 }[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const next = new Date(date);
    next.setDate(next.getDate() + offset);
    if (!enabled(isoDate(next))) return;
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
    requestAnimationFrame(() => calendar.current?.querySelector<HTMLButtonElement>(`[data-date="${isoDate(next)}"]`)?.focus());
  };
  return <Popover.Root open={open} onOpenChange={(next) => {
    setOpen(next);
    if (next) setMonth(parseDate(value) ?? new Date());
  }}>
    <Popover.Trigger id={id} className={`date-picker-trigger ${className ?? ""}`} disabled={disabled || readOnly} aria-label={props["aria-label"] ?? (value ? `Ngày ${value.split("-").reverse().join("/")}` : "Chọn ngày")} aria-describedby={props["aria-describedby"]} aria-required={required}>
      <span data-placeholder={!value || undefined}>{value ? value.split("-").reverse().join("/") : placeholder || "dd/mm/yyyy"}</span><CalendarDays size={18} aria-hidden="true" />
    </Popover.Trigger>
    {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
    <Popover.Portal>
      <Popover.Positioner className="date-picker-positioner" sideOffset={8} align="start">
        <Popover.Popup className="date-picker-popup" aria-label="Chọn ngày" aria-describedby={generatedId} initialFocus={() => calendar.current?.querySelector<HTMLButtonElement>('[data-selected="true"]') ?? calendar.current?.querySelector<HTMLButtonElement>('[data-today="true"]') ?? calendar.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? true}>
          <div className="date-picker-heading">
            <button type="button" onClick={() => move(-1)} aria-label="Tháng trước"><ChevronLeft size={17} /></button>
            <div className="date-picker-period">
              <StyledSelect value={month.getMonth()} onChange={(next) => setMonth(new Date(month.getFullYear(), Number(next), 1, 12))} options={Array.from({ length: 12 }, (_, index) => ({ value: index, label: `Tháng ${index + 1}` }))} />
              <StyledSelect value={month.getFullYear()} onChange={(next) => setMonth(new Date(Number(next), month.getMonth(), 1, 12))} options={Array.from({ length: Math.max(new Date().getFullYear() + 100, month.getFullYear()) - Math.min(1900, month.getFullYear()) + 1 }, (_, index) => { const year = Math.min(1900, month.getFullYear()) + index; return { value: year, label: String(year) }; })} />
            </div>
            <button type="button" onClick={() => move(1)} aria-label="Tháng sau"><ChevronRight size={17} /></button>
          </div>
          <div className="date-picker-week" aria-hidden="true">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="date-picker-days" ref={calendar} aria-label={`Tháng ${month.getMonth() + 1} năm ${month.getFullYear()}`}>
            {days.map((date) => { const day = isoDate(date); return <button type="button" key={day} data-date={day} data-selected={day === value || undefined} data-today={day === today || undefined} data-outside={date.getMonth() !== month.getMonth() || undefined} disabled={!enabled(day)} aria-label={day.split("-").reverse().join("/")} aria-pressed={day === value} aria-current={day === today ? "date" : undefined} onKeyDown={(event) => navigate(event, date)} onClick={() => select(day)}>{date.getDate()}</button>; })}
          </div>
          <div className="date-picker-footer"><button type="button" onClick={() => select("")} disabled={required || !value}>Xóa ngày</button><button type="button" disabled={!enabled(today)} onClick={() => select(today)}>Hôm nay</button></div>
          <span id={generatedId} className="sr-only">Dùng phím mũi tên để chuyển ngày, Enter để chọn.</span>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
