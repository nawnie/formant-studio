import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

export function IconButton({
  label,
  children,
  active,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""} ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 48 44" aria-hidden="true">
        <path d="M2 27 10 15 18 29 26 3 36 39 46 19" />
      </svg>
      <span>FORMANT</span>
    </div>
  );
}
export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
  color = "var(--accent)",
  ariaLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
  color?: string;
  ariaLabel?: string;
}) {
  const portion = (value - min) / (max - min);
  return (
    <label
      className="knob-control"
      style={{ "--knob-color": color } as CSSProperties}
    >
      <span className="knob-label">{label}</span>
      <span className="knob-body">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle
            className="knob-track"
            cx="32"
            cy="32"
            r="25"
            pathLength="100"
          />
          <circle
            className="knob-value"
            cx="32"
            cy="32"
            r="25"
            pathLength="100"
            strokeDasharray={`${portion * 75} 100`}
          />
          <circle className="knob-face" cx="32" cy="32" r="20" />
          <line
            x1="32"
            y1="15"
            x2="32"
            y2="22"
            transform={`rotate(${-135 + portion * 270} 32 32)`}
          />
        </svg>
        <input
          aria-label={ariaLabel || label}
          aria-valuetext={display}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </span>
      <output>{display}</output>
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
