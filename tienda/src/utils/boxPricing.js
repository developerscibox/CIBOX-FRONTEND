// Bodega 12 vende SOLO por caja. La "caja" es el tier de mayor min_qty.
// Ojo: tier.price es POR UNIDAD; el precio total de la caja = price * min_qty.

export const boxTierOf = (product) => {
  const tiers = [...(product?.pricing?.tiers || [])].sort(
    (a, b) => (a?.min_qty || 1) - (b?.min_qty || 1),
  );
  return tiers[tiers.length - 1] || null;
};

// Unidades por caja (cantidad mínima del tier de caja). Siempre >= 1.
export const boxQtyOf = (product) => {
  const qty = boxTierOf(product)?.min_qty;
  return qty && qty > 1 ? qty : 1;
};
