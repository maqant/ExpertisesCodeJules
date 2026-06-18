import { useEffect, useRef } from 'react';
import localforage from 'localforage';
import { telemetryBus } from '../ai/telemetryBus.js';

// Clé de stockage pour localforage
export const TELEMETRY_STORAGE_KEY = 'expertise_telemetry_logs';

/**
 * useTelemetry Hook
 * 
 * @param {string} sessionId - L'identifiant de la session en cours (généralement le dossierId ou un UUID).
 * @param {string} dossierId - L'ID du dossier courant (optionnel).
 */
export function useTelemetry(sessionId, dossierId = null) {
    const timers = useRef(new Map());
    const focusValues = useRef(new Map());

    // S'abonner aux événements du Bus IA
    useEffect(() => {
        if (!sessionId) return;
        const handleAiEvent = (event) => {
            const entry = {
                id: crypto.randomUUID(),
                sessionId,
                dossierId,
                ...event
            };
            persistLog(entry);
        };
        return telemetryBus.subscribe(handleAiEvent);
    }, [sessionId, dossierId]);

    // --- Fonction interne de log vers localforage ---
    const persistLog = async (logEntry) => {
        try {
            const existingLogs = (await localforage.getItem(TELEMETRY_STORAGE_KEY)) || [];
            existingLogs.push(logEntry);
            await localforage.setItem(TELEMETRY_STORAGE_KEY, existingLogs);
        } catch (err) {
            console.error("[Telemetry] Erreur lors de la sauvegarde :", err);
        }
    };

    /**
     * Enregistre un événement de télémétrie de base.
     * 
     * @param {string} eventType - CLICK, EDIT, TOGGLE, DROP, AI_ACTION, TIME_SPENT, etc.
     * @param {string} componentId - L'identifiant clair de l'élément (ex: 'btn_dev_cause')
     * @param {object} details - Valeur avant/après, ou toute info contextuelle
     */
    const logEvent = (eventType, componentId, details = {}) => {
        if (!sessionId) return; // Ne pas loguer si pas de session active

        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            sessionId,
            dossierId,
            eventType,
            componentId,
            details
        };

        // Optionnel : un console.log conditionnel pour le débug en local
        // console.log("[Telemetry Log]", entry);

        persistLog(entry);
    };

    /**
     * Enregistre le focus sur un champ (pour chronométrer ou voir l'ancienne valeur).
     */
    const logFocus = (componentId, initialValue, inferred = false) => {
        focusValues.current.set(componentId, initialValue);
        logEvent('FOCUS', componentId, { initialValue, inferred });
        startTimer(componentId);
    };

    /**
     * Enregistre la perte de focus, en vérifiant si la valeur a changé (utile pour corrections post-IA).
     */
    const logBlur = (componentId, finalValue, inferred = false) => {
        const timeSpent = stopTimer(componentId);
        const initialValue = focusValues.current.get(componentId);
        focusValues.current.delete(componentId);
        const changed = initialValue !== undefined && initialValue !== finalValue;
        
        logEvent('BLUR', componentId, { 
            changed, 
            timeSpentMs: timeSpent,
            initialValue,
            finalValue,
            inferred
        });
    };

    /**
     * Démarre un chronomètre interne pour un composant donné.
     */
    const startTimer = (componentId) => {
        timers.current.set(componentId, Date.now());
    };

    /**
     * Arrête le chronomètre et retourne le temps écoulé en ms.
     */
    const stopTimer = (componentId) => {
        const start = timers.current.get(componentId);
        if (start) {
            const duration = Date.now() - start;
            timers.current.delete(componentId);
            return duration;
        }
        return null;
    };

    return {
        logEvent,
        logFocus,
        logBlur,
        startTimer,
        stopTimer
    };
}

/**
 * Exporte l'intégralité des logs stockés au format JSON.
 */
export async function exportTelemetryJson() {
    try {
        const logs = await localforage.getItem(TELEMETRY_STORAGE_KEY) || [];
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `telemetry_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        return true;
    } catch (err) {
        console.error("Erreur lors de l'export des logs télémétrie :", err);
        return false;
    }
}

/**
 * Vide les logs de la base (pour ne pas surcharger à l'infini).
 */
export async function clearTelemetryLogs() {
    try {
        await localforage.removeItem(TELEMETRY_STORAGE_KEY);
    } catch (err) {
        console.error("Erreur lors du nettoyage des logs :", err);
    }
}
