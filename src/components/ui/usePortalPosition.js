import { useLayoutEffect, useState, useCallback } from 'react';

/**
 * Calcule la position absolue (viewport) d'un anchor pour placer un popover
 * via Portal. Recalcule sur scroll/resize. Gère le flip vers le haut.
 */
export function usePortalPosition(anchorRef, open, estimatedHeight = 192) {
  const [coords, setCoords] = useState(null);

  const compute = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const flipUp = spaceBelow < estimatedHeight && r.top > spaceBelow;

    setCoords({
      left: r.left,
      width: r.width,
      top: flipUp ? undefined : r.bottom + 4,
      bottom: flipUp ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: flipUp ? r.top - 8 : spaceBelow - 8,
    });
  }, [anchorRef, estimatedHeight]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    compute();
    const opts = { passive: true, capture: true };
    window.addEventListener('scroll', compute, opts);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, opts);
      window.removeEventListener('resize', compute);
    };
  }, [open, compute]);

  return coords;
}
