import { create } from "zustand";

/**
 * Cola de alertas propias de Cibox (reemplaza window.alert y Alert.alert).
 *
 * POR QUÉ UNA COLA Y NO UNA SOLA ALERTA
 * `window.alert` es bloqueante: detiene el hilo hasta que la persona acepta, y
 * dos avisos seguidos salen uno tras otro sin perderse. Un modal propio NO
 * bloquea, así que dos llamadas seguidas —por ejemplo el error de un campo y
 * después el de otro— harían que la segunda pisara a la primera y nadie leería
 * la primera. Con una cola, cada aviso espera su turno y se comporta como la
 * gente ya espera.
 *
 * El store guarda solo datos serializables salvo las funciones de respuesta,
 * que son lo que permite conservar la forma de `confirmAppAction` sin tocar
 * las pantallas que ya la usan.
 */
const useAlertStore = create((set, get) => ({
  /** Avisos esperando turno. El primero del arreglo es el que se ve. */
  cola: [],

  /** Encola un aviso. `alerta` = { titulo, mensaje, tipo, confirmar, ... } */
  push: (alerta) => set((s) => ({ cola: [...s.cola, alerta] })),

  /**
   * Cierra el aviso visible. `confirmado` distingue "Aceptar" de "Cancelar"
   * para los que preguntan; los informativos lo ignoran.
   */
  cerrar: (confirmado = false) => {
    const actual = get().cola[0];
    set((s) => ({ cola: s.cola.slice(1) }));
    if (!actual) return;
    // El callback se llama DESPUÉS de sacar el aviso de la cola: si lo que hace
    // abre otra alerta, esa entra detrás y no se pierde ninguna.
    if (confirmado && typeof actual.onConfirm === "function") actual.onConfirm();
    if (!confirmado && typeof actual.onCancel === "function") actual.onCancel();
  },
}));

export default useAlertStore;
