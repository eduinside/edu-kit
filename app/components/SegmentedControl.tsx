import type { CSSProperties } from "react";

export interface SegOption {
  key: string;
  label: string;
}

interface Props {
  options: SegOption[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}

const track: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: 3,
  background: "var(--color-slate-100)",
  borderRadius: 8,
};

export default function SegmentedControl({ options, value, onChange, ariaLabel }: Props) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={track}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            style={{
              height: 28,
              padding: "0 12px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              transition: "all .15s ease",
              background: active ? "#fff" : "transparent",
              color: active ? "var(--color-brand-700)" : "var(--color-slate-500)",
              boxShadow: active ? "var(--shadow-sm, 0 1px 2px rgba(15,23,42,.08))" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
