import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const tones = {
  neutral: { text: "text-slate-700", dot: "bg-slate-400", chip: "bg-slate-100" },
  red: { text: "text-red-700", dot: "bg-red-600", chip: "bg-red-50" },
  amber: { text: "text-amber-800", dot: "bg-amber-500", chip: "bg-amber-50" },
  green: { text: "text-emerald-800", dot: "bg-emerald-600", chip: "bg-emerald-50" },
};

export default function AccessibleDropdown({ value, options, onChange, label, className = "", multiple = false, maxSelected = 4 }) {
  const id = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, options.findIndex((option) => option.value === value)));
  const values = multiple ? value : [value];
  const choose = (next) => {
    if (!multiple) { onChange(next); setOpen(false); return; }
    if (values.includes(next)) onChange(values.filter(item => item !== next));
    else if (values.length < maxSelected) onChange([...values, next]);
  };
  const selected = multiple ? options.find(option => values.includes(option.value) && option.tone === "red") ?? options.find(option => values.includes(option.value)) : options.find((option) => option.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const keyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((index) => event.key === "ArrowDown" ? (index + 1) % options.length : (index - 1 + options.length) % options.length);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) { choose(option.value); }
    }
  };
  const selectedTone = tones[selected?.tone] ?? tones.neutral;
  return <div ref={rootRef} className={`relative min-w-0 ${className}`}>
    <button type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined} onKeyDown={keyDown} onClick={() => { setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value))); setOpen((current) => !current); }} className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-medium outline-none hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-600">
      <span className={`flex min-w-0 items-center gap-2 truncate ${selectedTone.text}`}><span className={`h-2 w-2 shrink-0 rounded-full ${selectedTone.dot}`} aria-hidden="true" />{multiple ? (values.length ? values.length + " selected" : "Select all that apply") : selected?.label}{selected?.tag && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${selectedTone.chip}`}>{selected.tag}</span>}</span><ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {multiple && <div className="mt-2 flex flex-wrap gap-2">{values.map(item => {
      const option = options.find(entry => entry.value === item);
      const tone = tones[option?.tone] ?? tones.neutral;
      return <button key={item} type="button" aria-label={`Remove ${item}`} onClick={() => choose(item)} className={`rounded-full border px-3 py-2 text-xs ${tone.text} ${tone.chip}`}>{item} {option?.tag && <strong>{option.tag}</strong>} <span aria-hidden="true">&times;</span></button>;
    })}</div>}
    {open && <div id={`${id}-list`} role="listbox" aria-multiselectable={multiple || undefined} aria-label={label} className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      {options.map((option, index) => { const tone = tones[option.tone] ?? tones.neutral; return <button key={option.value} id={`${id}-option-${index}`} type="button" role="option" aria-selected={values.includes(option.value)} aria-disabled={multiple && !values.includes(option.value) && values.length >= maxSelected} onMouseEnter={() => setActiveIndex(index)} onClick={() => { choose(option.value); }} className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${tone.text} ${index === activeIndex ? "bg-slate-50" : ""}`}><span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />{multiple && <span aria-hidden="true">{values.includes(option.value) ? "Selected" : "+"}</span>}{option.label}{option.tag && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tone.chip}`}>{option.tag}</span>}</button>; })}
    </div>}
  </div>;
}
