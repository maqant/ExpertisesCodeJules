import { describe, it, expect } from 'vitest';
import { resolveSinistreDate } from './dateResolver';

const FIXED_NOW = new Date(2024, 4, 15); // 15/05/2024

describe('resolveSinistreDate', () => {
    it('utilise la date sinistre IA quand elle est valide (DD/MM/YYYY)', () => {
        expect(resolveSinistreDate({ aiDate: '03/01/2023', now: FIXED_NOW }))
            .toEqual({ date: '03/01/2023', source: 'sinistre' });
    });

    it('normalise une année sur 2 chiffres en 4 chiffres', () => {
        expect(resolveSinistreDate({ aiDate: '3/1/23', now: FIXED_NOW }))
            .toEqual({ date: '03/01/2023', source: 'sinistre' });
    });

    it('bascule sur la déclaration si IA = "A confirmer"', () => {
        expect(resolveSinistreDate({
            aiDate: 'A confirmer',
            declarationDate: '10/02/2024',
            now: FIXED_NOW,
        })).toEqual({ date: '10/02/2024', source: 'declaration' });
    });

    it('bascule sur aujourd\'hui si IA et déclaration invalides', () => {
        expect(resolveSinistreDate({ aiDate: 'NC', declarationDate: null, now: FIXED_NOW }))
            .toEqual({ date: '15/05/2024', source: 'fallback_today' });
    });

    it('rejette une date impossible et bascule en fallback', () => {
        expect(resolveSinistreDate({ aiDate: '31/02/2024', now: FIXED_NOW }))
            .toEqual({ date: '15/05/2024', source: 'fallback_today' });
    });

    it('rejette un format non reconnu', () => {
        expect(resolveSinistreDate({ aiDate: '1er janvier 2024', now: FIXED_NOW }))
            .toEqual({ date: '15/05/2024', source: 'fallback_today' });
    });
});
