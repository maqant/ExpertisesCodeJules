import { useMemo, useState, useCallback, useEffect } from 'react';

/**
 * Logique de combobox isolée de l'UI.
 * - Dédoublonnage O(N) par label.
 * - Filtrage insensible à la casse.
 * - activeIndex TOUJOURS clampé.
 */
export function useCombobox({ value, options, openOnEmpty }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const query = (value || '').trim().toLowerCase();
    const seen = new Set();
    const out = [];
    for (const o of options) {
      if (!o || typeof o.label !== 'string') continue;
      const key = o.label.toLowerCase();
      if (seen.has(key)) continue;
      if (query && !key.includes(query)) continue;
      seen.add(key);
      out.push(o);
    }
    return out;
  }, [value, options]);

  // Re-clamp obligatoire dès que la liste filtrée rétrécit -> évite le crash Enter.
  useEffect(() => {
    setActiveIndex((i) => (i >= filtered.length ? Math.max(-1, filtered.length - 1) : i));
  }, [filtered.length]);

  const move = useCallback(
    (delta) => {
      if (filtered.length === 0) return;
      setActiveIndex((i) => {
        const next = i + delta;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
    },
    [filtered.length],
  );

  const reset = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const getActiveOption = useCallback(
    () => (activeIndex >= 0 && activeIndex < filtered.length ? filtered[activeIndex] : null),
    [activeIndex, filtered],
  );

  return {
    open,
    setOpen,
    activeIndex,
    setActiveIndex,
    filtered,
    move,
    reset,
    getActiveOption,
    shouldOpenOnEmpty: openOnEmpty,
  };
}
