export const getApiErrorMessage = (
  error,
  fallback = "No se pudo completar la acción"
) => {
  const data = error?.response?.data;
  const details = Array.isArray(data?.details) ? data.details : [];
  const firstDetail = details[0];

  if (firstDetail?.message) return firstDetail.message;

  if (firstDetail?.path?.length) {
    return `Revisa el campo: ${firstDetail.path.join(".")}`;
  }

  return data?.message || error?.message || fallback;
};

export const getApiErrorField = (error) => {
  const data = error?.response?.data;
  const details = Array.isArray(data?.details) ? data.details : [];
  return details[0]?.path?.[0] || null;
};