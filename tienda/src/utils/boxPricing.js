/**
 * Precio de venta en la tienda.
 *
 * Cibox es un supermercado: el cliente compra POR UNIDAD de venta (una unidad,
 * un kilo, un pack…). El producto tiene un solo precio (`product.price`).
 *
 * Algunos productos además ofrecen un PACK con descuento: al llegar a
 * `pack_size` unidades, el backend aplica solo el precio del tramo del pack
 * (pricing.tiers). El cliente no está obligado a llevar el pack: es un
 * beneficio por cantidad, no un mínimo de compra.
 *
 * Se conservan los nombres `boxTierOf` / `boxQtyOf` porque los consumen varias
 * pantallas; lo que cambió es el significado (ya no hay venta forzada por caja).
 */

/** Tramo del PACK, si el producto tiene uno. null si se vende solo por unidad. */
export const boxTierOf = (product) => {
  const tiers = [...(product?.pricing?.tiers || [])].sort(
    (a, b) => (a?.min_qty || 1) - (b?.min_qty || 1),
  );
  const pack = tiers[tiers.length - 1];
  return pack && Number(pack.min_qty) > 1 ? pack : null;
};

/**
 * Paso de compra: SIEMPRE 1. En un supermercado el cliente puede llevar una
 * sola unidad. (Antes devolvía las unidades por caja porque Bodega 12 vendía
 * solo por bulto.)
 */
export const boxQtyOf = () => 1;

/** Unidades del pack con descuento, o 0 si el producto no tiene pack. */
export const packSizeOf = (product) =>
  Number(product?.pack_size || boxTierOf(product)?.min_qty || 0) || 0;

/** Precio unitario de lista del producto (con IVA incluido). */
export const unitPriceOf = (product) => {
  if (Number(product?.price) > 0) return Number(product.price);
  const tiers = product?.pricing?.tiers || [];
  const unidad = tiers.find((t) => Number(t.min_qty) === 1);
  return Number(unidad?.price ?? product?.pricing?.min_price ?? 0);
};

/** Precio total del pack, o null si no hay pack. */
export const packPriceOf = (product) => {
  const size = packSizeOf(product);
  if (size < 2) return null;
  if (Number(product?.pack_price) > 0) return Number(product.pack_price);
  const pack = boxTierOf(product);
  return pack ? Number(pack.price) * size : null;
};
