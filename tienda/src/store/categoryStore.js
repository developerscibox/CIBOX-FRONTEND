import { create } from "zustand";
import {
  getCategories,
  getCategoriesTree,
} from "../services/categoryService";
import { readCache, writeCache } from "../utils/catalogCache";

// Caché en memoria con TTL para evitar llamadas duplicadas a /categories.
// HomeScreen y WebHeader montan a la vez y pedían el árbol 2 veces;
// este store comparte el resultado y dedupe las peticiones en vuelo.
// Además persiste en disco (localStorage en web) para hidratar al instante
// tras un reload completo de la página (stale-while-revalidate).
const TTL_MS = 10 * 60 * 1000; // 10 min

const isFresh = (ts) => ts > 0 && Date.now() - ts < TTL_MS;

const cachedTree = readCache("store_tree");
const cachedFlat = readCache("store_flat");

const useCategoryStore = create((set, get) => ({
  tree: Array.isArray(cachedTree) ? cachedTree : [], // árbol (tree=true)
  flat: Array.isArray(cachedFlat) ? cachedFlat : [], // listado plano
  treeFetchedAt: 0,
  flatFetchedAt: 0,
  _treePromise: null, // petición en vuelo (dedupe)
  _flatPromise: null,

  // Árbol de categorías cacheado. force=true ignora el TTL.
  fetchTree: async ({ force = false } = {}) => {
    const { tree, treeFetchedAt, _treePromise } = get();
    if (!force && isFresh(treeFetchedAt) && tree.length) return tree;
    if (_treePromise) return _treePromise;

    const promise = (async () => {
      try {
        const items = await getCategoriesTree();
        const data = Array.isArray(items) ? items : [];
        set({ tree: data, treeFetchedAt: Date.now() });
        if (data.length) writeCache("store_tree", data);
        return data;
      } catch (e) {
        // No envenenar el TTL ante error: deja reintentar al próximo llamado.
        return get().tree;
      } finally {
        set({ _treePromise: null });
      }
    })();

    set({ _treePromise: promise });
    return promise;
  },

  // Listado plano cacheado. force=true ignora el TTL.
  fetchFlat: async ({ force = false } = {}) => {
    const { flat, flatFetchedAt, _flatPromise } = get();
    if (!force && isFresh(flatFetchedAt) && flat.length) return flat;
    if (_flatPromise) return _flatPromise;

    const promise = (async () => {
      try {
        const items = await getCategories();
        const data = Array.isArray(items) ? items : items?.items || [];
        set({ flat: data, flatFetchedAt: Date.now() });
        if (data.length) writeCache("store_flat", data);
        return data;
      } catch (e) {
        return get().flat;
      } finally {
        set({ _flatPromise: null });
      }
    })();

    set({ _flatPromise: promise });
    return promise;
  },
}));

export default useCategoryStore;
