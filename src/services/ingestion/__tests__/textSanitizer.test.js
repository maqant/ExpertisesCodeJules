import { describe, it, expect } from 'vitest';
import {
  fixMojibake,
  hasMojibake,
  sanitizeIngestedText,
} from '../textSanitizer.js';

describe('fixMojibake', () => {
  it('corrige le cas métier "rÃ©sidence" -> "résidence"', () => {
    expect(fixMojibake('rÃ©sidence')).toBe('résidence');
  });

  it('corrige une phrase complète corrompue', () => {
    const corrupt = 'DÃ©gÃ¢t des eaux Ã  la rÃ©sidence des Ã‰rables';
    expect(fixMojibake(corrupt)).toBe('Dégât des eaux à la résidence des Érables');
  });

  it('corrige les caractères spéciaux (€, œ, apostrophe typographique)', () => {
    expect(fixMojibake('cÅ“ur')).toBe('cœur');
    expect(fixMojibake('lâ€™assurance')).toBe('l’assurance');
    expect(fixMojibake('100â‚¬')).toBe('100€');
  });

  it('NE TOUCHE PAS un texte déjà propre (idempotence)', () => {
    const clean = 'Dégât des eaux à la résidence — 100€';
    expect(fixMojibake(clean)).toBe(clean);
  });

  it('est idempotent (double application sans effet)', () => {
    const corrupt = 'rÃ©sidence';
    const once = fixMojibake(corrupt);
    expect(fixMojibake(once)).toBe(once);
  });

  it('gère les entrées vides / invalides sans crash', () => {
    expect(fixMojibake('')).toBe('');
    expect(fixMojibake(null)).toBe('');
    expect(fixMojibake(undefined)).toBe('');
  });
});

describe('hasMojibake', () => {
  it('détecte le mojibake typique', () => {
    expect(hasMojibake('rÃ©sidence')).toBe(true);
    expect(hasMojibake('DÃ©gÃ¢t')).toBe(true);
  });

  it('ne détecte pas de mojibake sur un texte normal', () => {
    expect(hasMojibake('résidence')).toBe(false);
    expect(hasMojibake('Dégât des eaux')).toBe(false);
  });
});

describe('sanitizeIngestedText', () => {
  it('combine la correction et la normalisation NFC', () => {
    const corrupt = 'DÃ©gÃ¢t des eaux \u00A0 \u200B test';
    const sanitized = sanitizeIngestedText(corrupt);
    // 'Dégât des eaux   test' (espace insécable remplacé par espace, zero-width supprimé)
    expect(sanitized).toBe('Dégât des eaux   test');
  });
});
