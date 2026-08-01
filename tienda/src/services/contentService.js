import { useEffect, useState } from "react";
import client from "../api/client";
import { readCache, writeCache } from "../utils/catalogCache";

/**
 * Contenido editable de la home (CMS del panel bodega).
 *
 * GET /content/home es público y devuelve { slots|null, specs, updated_at }.
 * slots === null → tienda recién instalada: la home usa sus textos/imágenes
 * de fábrica (fallback exacto en cada componente).
 *
 * Patrón SWR (mismo que catalogCache para el catálogo): se pinta al instante
 * lo último conocido desde la caché persistente y se revalida en background.
 * Si la red falla, se mantiene lo cacheado.
 */

const unwrap = (response) => response.data?.data ?? response.data;

const CACHE_KEY = "home_content";

/** Lectura síncrona de los slots cacheados (para inicializar useState sin parpadeo). */
export const readCachedHomeSlots = () => {
  const cached = readCache(CACHE_KEY);
  return cached && typeof cached === "object" ? cached : null;
};

// Dedupe: header, footer y home montan casi juntos → una sola request.
let inflight = null;

/** Trae el contenido del CMS y persiste los slots en caché. Devuelve { slots, specs, updated_at }. */
export const getHomeContent = () => {
  if (!inflight) {
    inflight = client
      .get("/content/home")
      .then((response) => {
        const data = unwrap(response) || {};
        // slots null (nunca configurado) también se persiste: si el admin
        // vuelve al estado de fábrica, la caché no debe seguir mostrando lo viejo.
        const slots = data.slots && typeof data.slots === "object" ? data.slots : null;
        writeCache(CACHE_KEY, slots);
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

/**
 * Hook SWR: devuelve los slots del CMS (o null). Primer render = caché;
 * luego revalida una vez en background. En error de red conserva lo cacheado.
 */
export const useHomeSlots = () => {
  const [slots, setSlots] = useState(readCachedHomeSlots);
  useEffect(() => {
    let alive = true;
    getHomeContent()
      .then((data) => {
        if (!alive) return;
        setSlots(data?.slots && typeof data.slots === "object" ? data.slots : null);
      })
      .catch(() => {
        // red caída: mantener lo cacheado / fallback de fábrica
      });
    return () => {
      alive = false;
    };
  }, []);
  return slots;
};

/** Texto del CMS con fallback exacto: usa el valor solo si es string no vacío. */
export const cmsText = (value, fallback) =>
  typeof value === "string" && value.trim() ? value : fallback;
