/**
 * Bus de télémétrie agnostique de React.
 * La couche service émet ici ; React (useTelemetry) s'abonne.
 * Pattern : Observer. Aucune dépendance UI, testable, scalable
 */

class TelemetryBus {
  #sinks = new Set();

  /**
   * Abonne un consommateur (ex: le hook React qui persiste en IndexedDB).
   * @param {Function} sink
   * @returns {Function} fonction de désabonnement
   */
  subscribe(sink) {
    this.#sinks.add(sink);
    return () => this.#sinks.delete(sink);
  }

  /**
   * Émet un événement. Volontairement "fire-and-forget" et tolérant aux pannes.
   * @param {Object} event
   */
  emit(event) {
    for (const sink of this.#sinks) {
      try {
        sink(event);
      } catch (err) {
        console.warn('[TelemetryBus] sink en échec, événement ignoré :', err);
      }
    }
  }
}

// Singleton applicatif.
export const telemetryBus = new TelemetryBus();
