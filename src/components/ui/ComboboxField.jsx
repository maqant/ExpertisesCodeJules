import { useEffect, useId, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCombobox } from './useCombobox';
import { usePortalPosition } from './usePortalPosition';

/**
 * Champ combobox critique (ex. franchise).
 * - Liste rendue dans un Portal => jamais coupée par overflow de modale.
 * - activeIndex clampé en interne => aucune valeur fantôme commitée.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {(v:string)=>void} props.onChange  édition libre
 * @param {(v:string)=>void} props.onCommit  validation finale (blur / select / Enter)
 * @param {Array<{id:string,label:string}>} props.options
 * @param {boolean} props.openOnEmpty
 * @param {string} props.className
 * @param {string} props.placeholder
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
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const {
    open, setOpen, activeIndex, setActiveIndex,
    filtered, move, reset, getActiveOption, shouldOpenOnEmpty,
  } = useCombobox({ value, options, openOnEmpty });

  const coords = usePortalPosition(rootRef, open);

  const commit = useCallback((raw) => { onCommit?.(raw); reset(); }, [onCommit, reset]);
  const select = useCallback((label) => { onChange?.(label); commit(label); }, [onChange, commit]);

  // Fermeture au clic extérieur (input + portal).
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      const inRoot = rootRef.current?.contains(e.target);
      const listEl = document.getElementById(listId);
      const inList = listEl?.contains(e.target);
      if (!inRoot && !inList) { commit(value); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, listId, value, commit]);

  const handleChange = (e) => {
    const next = e.target.value;
    onChange?.(next);
    if (next.trim() === '' && !shouldOpenOnEmpty) setOpen(false);
    else setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp':   e.preventDefault(); move(-1); break;
      case 'Enter': {
        const opt = getActiveOption();
        if (opt) { e.preventDefault(); select(opt.label); }
        else { e.preventDefault(); commit(value); }
        break;
      }
      case 'Escape': e.preventDefault(); setOpen(false); break;
      default: break;
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
      />

      {open && filtered.length > 0 && coords && createPortal(
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'fixed', // relative to viewport
            left: coords.left,
            width: coords.width,
            top: coords.top,
            bottom: coords.bottom,
            maxHeight: coords.maxHeight,
          }}
          className="z-[10000] overflow-auto rounded border border-slate-500 bg-slate-800 shadow-xl backdrop-blur-md"
        >
          {filtered.map((o, idx) => (
            <li
              key={o.id}
              role="option"
              id={`${listId}-opt-${idx}`}
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // évite de voler le focus de l'input
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
        </ul>,
        document.body
      )}
    </div>
  );
}
