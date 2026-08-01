import { Platform } from "react-native";

/**
 * Caché persistente del catálogo para "stale-while-revalidate".
 *
 * Por qué: al entrar a la tienda, el usuario veía solo un skeleton hasta que
 * el backend respondía (peor aún si Render estaba dormido → ~50s). Guardando
 * el último catálogo conocido podemos PINTARLO al instante en el primer render
 * y revalidar en segundo plano. Returning visitors ven productos en 0ms.
 *
 * En web usamos localStorage (lectura síncrona → sirve para inicializar
 * useState sin parpadeo). En nativo no hay localStorage; caemos a un Map en
 * memoria (vive durante la sesión de la app). El foco del problema es la web.
 */

const PREFIX = "cibox:catalog:";
const hasLS =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  !!window.localStorage;

const mem = new Map();

export const readCache = (key) => {
  try {
    if (hasLS) {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    }
    return mem.has(key) ? mem.get(key) : null;
  } catch {
    return null;
  }
};

export const writeCache = (key, value) => {
  try {
    if (hasLS) {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } else {
      mem.set(key, value);
    }
  } catch {
    // Cuota llena / modo privado: ignorar, la app sigue funcionando sin caché.
  }
};
