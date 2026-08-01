import { create } from "zustand";

// Toast no bloqueante (reemplaza window.alert/Alert para feedback liviano).
// El store controla la visibilidad y su propio auto-cierre; el componente
// <Toast/> solo refleja este estado (evita desincronización de estado local).
let hideTimer = null;
const DURATION = 2600;

const useToastStore = create((set) => ({
  visible: false,
  message: "",
  type: "success", // success | error | info
  show: (message, type = "success") => {
    set({ visible: true, message, type });
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => set({ visible: false }), DURATION);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ visible: false });
  },
}));

export default useToastStore;

// Helper para llamar desde cualquier parte sin hook.
export const showToast = (message, type = "success") =>
  useToastStore.getState().show(message, type);
