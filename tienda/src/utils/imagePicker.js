import * as ImagePicker from "expo-image-picker";

export const pickMultipleImages = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Debes permitir acceso a la galería");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 6,
    quality: 0.8,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets || [];
};

// Comprobante de transferencia: sin allowsEditing para no forzar un recorte
// que pueda cortar los datos de la transferencia.
export const pickReceiptImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Debes permitir acceso a la galería");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets?.[0] || null;
};

export const pickSingleImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Debes permitir acceso a la galería");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets?.[0] || null;
};