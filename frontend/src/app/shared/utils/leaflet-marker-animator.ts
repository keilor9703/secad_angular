/**
 * Anima marcadores de Leaflet entre fixes GPS sucesivos en vez de teletransportarlos.
 *
 * El GPS de patrullas se refresca cada 10-15s (ver GespoUbicacionPollerService en el
 * backend y el polling de 8-15s en turnos.ts/eventos.ts). Si el marker simplemente
 * "salta" a la nueva coordenada en cada refresco se ve a tirones; acá se desliza
 * suavemente durante la ventana entre refrescos, dando la sensación de movimiento
 * continuo aunque el dato subyacente solo llegue cada tantos segundos.
 *
 * No depende de los tipos de Leaflet (el proyecto usa `declare const L: any` cargado
 * vía CDN) — solo necesita que `marker` tenga `getLatLng()`/`setLatLng()`.
 */

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Desliza `marker` desde su posición actual hasta (targetLat, targetLng) durante
 * `durationMs`. Si la distancia es insignificante (< 1m, ruido de precisión GPS) o
 * el marker no tiene posición previa (recién creado), se posiciona directo sin animar.
 */
export function animateMarkerTo(
  marker: any,
  targetLat: number,
  targetLng: number,
  durationMs = 2500
): void {
  const start = marker.getLatLng?.();
  if (!start) { marker.setLatLng([targetLat, targetLng]); return; }

  const distanceMeters = haversineMeters(start.lat, start.lng, targetLat, targetLng);
  if (distanceMeters < 1) return; // ya está ahí — nada que animar

  stopMarkerAnimation(marker);

  const startLat = start.lat;
  const startLng = start.lng;
  const dLat = targetLat - startLat;
  const dLng = targetLng - startLng;
  const startTime = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    const eased = 1 - Math.pow(1 - t, 2); // ease-out cuadrático
    marker.setLatLng([startLat + dLat * eased, startLng + dLng * eased]);

    if (t < 1) {
      marker.__animFrame = requestAnimationFrame(step);
    } else {
      marker.__animFrame = null;
    }
  };
  marker.__animFrame = requestAnimationFrame(step);
}

/** Cancela la animación en curso de `marker`, si hay alguna — llamar antes de removerlo del mapa. */
export function stopMarkerAnimation(marker: any): void {
  if (marker?.__animFrame) {
    cancelAnimationFrame(marker.__animFrame);
    marker.__animFrame = null;
  }
}
