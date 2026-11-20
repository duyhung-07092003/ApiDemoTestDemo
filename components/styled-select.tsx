"use client";

import { useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { Select } from "@base-ui/react/select";

export type StyledSelectOption = { value: string | number; label: string; disabled?: boolean; keywords?: string; status?: string; tone?: "danger" | "success" };

const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

export function StyledSelect({ value, options, onChange, disabled, className = "", searchable = false, searchPlaceholder = "Tìm kiếm..." }: {
  value: string | number;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");
  const selected = options.find((option) => String(option.value) === String(value));
  const needle = normalizeSearch(search.trim());
  const visibleOptions = needle ? options.filter((option) => normalizeSearch(`${option.label} ${option.keywords ?? ""}`).includes(needle)) : options;
  const optionContent = (option: StyledSelectOption) => <span className="styled-select-option-content"><span>{option.label}</span>{option.status && <span className={`styled-select-status ${option.tone ?? ""}`}>{option.status}</span>}</span>;
  return <Select.Root value={String(value)} onValueChange={(next) => { if (next !== null) onChange(next); }} onOpenChange={(open) => { if (!open) setSearch(""); }} disabled={disabled}>
    <Select.Trigger className={`styled-select-trigger ${className}`} aria-label={selected?.label}>
      <Select.Value>{selected ? optionContent(selected) : ""}</Select.Value><ChevronDown size={16} aria-hidden="true" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner className="styled-select-positioner" sideOffset={6} alignItemWithTrigger={false}>
        <Select.Popup className="styled-select-popup">
          {searchable && <div className="styled-select-search"><Search size={15} aria-hidden="true" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></div>}
          <Select.List className="styled-select-list">
            {visibleOptions.map((option) => <Select.Item className="styled-select-item" key={String(option.value)} value={String(option.value)} disabled={option.disabled} data-tone={option.tone}>
              <Select.ItemText>{optionContent(option)}</Select.ItemText><Select.ItemIndicator className="styled-select-check"><Check size={15} /></Select.ItemIndicator>
            </Select.Item>)}
            {!visibleOptions.length && <div className="styled-select-empty">Không tìm thấy kết quả phù hợp</div>}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>;
}
