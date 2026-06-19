import { useEffect, useId, useRef, useState } from 'react';

/**
 * Champ hybride : saisie libre + sélection dans une liste.
 * Headless sur la donnée : ne sait rien de "franchise", il manipule
 * des { id, label }. Réutilisable pour tout champ standardisable.
 *
 * @param {Object}   props
 * @param {string}   props.value
 * @param {(v: string) => void} props.onChange     Renvoie la valeur (brute pendant la frappe).
 * @param {(v: string) => void} [props.onCommit]   Renvoie la valeur normalisée (blur / sélection).
 * @param {Array<{id: string, label: string}>} props.options
 * @param {boolean}  [props.openOnEmpty=true]      Ouvre la liste quand le champ est vidé.
 * @param {string}   [props.className]
 * @param {string}   [props.placeholder]
 */
export default function ComboboxField({
  value = '',
  onChange,
  onCommit,
  options = [],
  openOnEmpty = true,
  className = '',
  placeholder = '',
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const listId = useId();

  // Filtrage + dédoublonnage par label (les options dynamiques peuvent dupliquer).
  const query = (value || '').toLowerCase();
  const filtered = options
    .filter((o, i, arr) => arr.findIndex((x) => x.label === o.label) === i)
    .filter((o) => o.label.toLowerCase().includes(query));

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const commit = (raw) => {
    onCommit?.(raw);
    setOpen(false);
    setActiveIndex(-1);
  };

  const select = (label) => {
    onChange?.(label);
    commit(label);
  };

  const handleChange = (e) => {
    const next = e.target.value;
    onChange?.(next);
    // Exigence métier : ouverture automatique au vidage.
    if (next.trim() === '' && openOnEmpty) setOpen(true);
    else setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      select(filtered[activeIndex].label);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => commit(value)}
        onKeyDown={handleKeyDown}
        className={className}
      />

      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1000] mt-1 w-full max-h-48 overflow-auto rounded border border-slate-600 bg-slate-800 shadow-lg"
        >
          {filtered.map((o, idx) => (
            <li
              key={o.id}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                select(o.label);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`cursor-pointer px-3 py-2 text-xs font-bold transition-colors ${
                idx === activeIndex
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-200 hover:bg-slate-700'
              }`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
