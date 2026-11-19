"use client";

import { ChevronDown, Check } from "lucide-react";
import { Select } from "@base-ui/react/select";

export type StyledSelectOption = { value: string | number; label: string; disabled?: boolean };

export function StyledSelect({ value, options, onChange, disabled, className = "" }: {
  value: string | number;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = options.find((option) => String(option.value) === String(value));
  return <Select.Root value={String(value)} onValueChange={(next) => { if (next !== null) onChange(next); }} disabled={disabled}>
    <Select.Trigger className={`styled-select-trigger ${className}`} aria-label={selected?.label}>
      <Select.Value>{selected?.label ?? ""}</Select.Value><ChevronDown size={16} aria-hidden="true" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner className="styled-select-positioner" sideOffset={6} alignItemWithTrigger={false}>
        <Select.Popup className="styled-select-popup">
          <Select.List className="styled-select-list">
            {options.map((option) => <Select.Item className="styled-select-item" key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
              <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator className="styled-select-check"><Check size={15} /></Select.ItemIndicator>
            </Select.Item>)}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>;
}
