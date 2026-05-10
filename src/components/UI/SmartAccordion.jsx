import React, { useState, useRef, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * SmartAccordion — v5.2.0
 * Accordéon intelligent avec badge de statut ERP.
 *
 * Props:
 *  - title (string)
 *  - icon (string, emoji)
 *  - num (number|string, optional section number)
 *  - statusType ('static' | 'dynamic')
 *  - isComplete (boolean, for static)
 *  - count (number, for dynamic)
 *  - minCount (number, default 1)
 *  - countLabel (string, default "encodé(s)")
 *  - defaultOpen (boolean)
 *  - editable (boolean) — double-click to rename
 *  - onTitleChange (fn)
 *  - children
 */
const SmartAccordion = ({
  title,
  icon,
  num,
  statusType = 'static',
  isComplete = false,
  count = 0,
  minCount = 1,
  countLabel = 'encodé(s)',
  defaultOpen = false,
  editable = false,
  onTitleChange,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isEditing, setIsEditing] = useState(false);

  // Drag-over auto-open
  const dragTimer = useRef(null);
  const wasAutoOpened = useRef(false);

  const handleDragEnterHeader = useCallback((e) => {
    e.preventDefault();
    if (!isOpen) {
      dragTimer.current = setTimeout(() => {
        setIsOpen(true);
        wasAutoOpened.current = true;
      }, 600);
    }
  }, [isOpen]);

  const handleDragLeaveHeader = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragTimer.current) {
        clearTimeout(dragTimer.current);
        dragTimer.current = null;
      }
    }
  }, []);

  const handleDropHeader = useCallback(() => {
    if (dragTimer.current) {
      clearTimeout(dragTimer.current);
      dragTimer.current = null;
    }
    // Keep open on drop
    wasAutoOpened.current = false;
  }, []);

  // Badge rendering
  const renderBadge = () => {
    if (statusType === 'static') {
      return isComplete ? (
        <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 backdrop-blur-md px-2 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_10px_rgba(16,185,129,0.1)]">
          ✅ Complet
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 backdrop-blur-md px-2 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_10px_rgba(245,158,11,0.1)]">
          🟡 À compléter
        </span>
      );
    }
    if (statusType === 'dynamic') {
      if (count < minCount) {
        return (
          <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold bg-red-500/10 text-red-400 border border-red-500/20 backdrop-blur-md px-2 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_10px_rgba(239,68,68,0.1)]">
            🔴 Minimum requis
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold bg-white/5 text-slate-300 border border-white/10 backdrop-blur-md px-2 py-0.5 rounded-full whitespace-nowrap">
          {count} {countLabel}
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`mb-3 rounded-2xl border transition-all duration-300 group ${isOpen ? 'bg-white/[0.03] border-white/10 shadow-2xl shadow-black/60' : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.08]'}`}>
      {/* Header */}
      <div
        className={`p-3.5 flex items-center cursor-pointer select-none transition-all duration-300 rounded-t-2xl hover:bg-white/[0.03] ${isOpen ? 'border-b border-white/[0.05]' : ''}`}
        onClick={() => !isEditing && setIsOpen((p) => !p)}
        onDragEnter={handleDragEnterHeader}
        onDragLeave={handleDragLeaveHeader}
        onDrop={handleDropHeader}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Chevron */}
        <ChevronRight
          className={`w-4 h-4 text-slate-400 shrink-0 mr-2 transition-transform duration-300 ${isOpen ? 'rotate-90 text-indigo-400' : 'group-hover:text-slate-300'}`}
        />

        {/* Number */}
        {num != null && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold shrink-0 mr-3 pointer-events-none border border-indigo-500/30">
            {num}
          </span>
        )}

        {/* Icon */}
        {icon && (
          <span className="mr-2 text-sm shrink-0 pointer-events-none">{icon}</span>
        )}

        {/* Title */}
        <div className="flex-1 min-w-0 mr-3">
          {editable && isEditing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-black/30 border border-indigo-500/50 outline-none text-[11px] font-bold uppercase tracking-wider text-indigo-300 w-full px-2 py-1 rounded-lg transition-all focus:ring-2 focus:ring-indigo-500/30"
              autoFocus
              onDoubleClick={(e) => e.stopPropagation()}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditing(false);
              }}
            />
          ) : (
            <span
              className="text-[11px] font-bold uppercase tracking-wider text-slate-200 truncate block hover:text-white transition-colors"
              title={editable ? 'Double-cliquez pour renommer' : undefined}
              onDoubleClick={(e) => {
                if (editable) {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEditing(true);
                }
              }}
            >
              {title}
            </span>
          )}
        </div>

        {/* Badge */}
        {renderBadge()}
      </div>

      {/* Body — CSS grid transition for smooth height animation */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
};

export default SmartAccordion;
