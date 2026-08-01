import client from '../api/client';

export const getPantry = async () => {
  const res = await client.get('/pantry');
  // El backend devuelve { data: { pantry: { items: [...] } } }.
  return res.data?.data?.pantry ?? res.data?.pantry ?? res.data;
};

// El backend espera frequency_days (int), no la cadena 'frequency'.
const FREQ_DAYS = { weekly: 7, biweekly: 14, monthly: 30 };

export const addItemToPantry = async ({ productId, quantity = 1, frequency = 'monthly', autoReorder = false }) => {
  const response = await client.post('/pantry/items', {
    productId,
    quantity,
    frequency_days: FREQ_DAYS[frequency] ?? 30,
    auto_reorder: autoReorder,
  });
  return response.data;
};

// Convierte TODA la despensa en un carrito activo. POST /pantry/checkout → { data: { cart } }.
export const checkoutPantry = async () => {
  const res = await client.post('/pantry/checkout');
  return res.data?.data?.cart ?? res.data?.cart ?? res.data;
};