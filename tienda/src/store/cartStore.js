import { create } from "zustand";
import { getCart } from "../services/cartService";

const useCartStore = create((set) => ({
  cartCount: 0,
  cartTotal: 0,
  loadingCart: false,

  loadCartSummary: async () => {
    try {
      set({ loadingCart: true });

      const cart = await getCart();
      const items = Array.isArray(cart?.items) ? cart.items : [];

      // Cibox vende por caja: el contador refleja CAJAS, no unidades.
      const count = items.reduce((acc, item) => {
        const boxQty = Number(item.box_qty) || 1;
        const cajas =
          boxQty > 1
            ? Math.max(1, Math.round(Number(item.quantity || 0) / boxQty))
            : Number(item.quantity || 0);
        return acc + cajas;
      }, 0);

      set({
        cartCount: count,
        cartTotal: Number(cart?.total || 0),
      });
    } catch (error) {
      console.log(
        "LOAD CART SUMMARY ERROR:",
        error?.response?.data || error.message,
      );

      set({
        cartCount: 0,
        cartTotal: 0,
      });
    } finally {
      set({ loadingCart: false });
    }
  },

  clearCartSummary: () => {
    set({
      cartCount: 0,
      cartTotal: 0,
    });
  },
}));

export default useCartStore;
