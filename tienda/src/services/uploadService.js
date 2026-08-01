import { Platform } from "react-native";
import client from "../api/client";

export const uploadImageAsync = async (asset, index = 0) => {
  const formData = new FormData();

  if (Platform.OS === "web") {
    if (!asset?.file) {
      throw new Error("No se encontró el archivo web de la imagen");
    }

    formData.append("image", asset.file);
  } else {
    formData.append("image", {
      uri: asset.uri,
      name: asset.fileName || `product_${Date.now()}_${index}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
  }

  const response = await client.post("/uploads/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  if (__DEV__) console.log("UPLOAD SINGLE RESPONSE:", response.data);

  const data = response.data?.data || response.data;

  return {
    url: data.url,
    publicId: data.publicId || data.key,
  };
};

export const uploadMultipleImagesAsync = async (assets = []) => {
  const formData = new FormData();

  assets.forEach((asset, index) => {
    if (Platform.OS === "web") {
      if (asset?.file) {
        formData.append("images", asset.file);
      }
    } else {
      formData.append("images", {
        uri: asset.uri,
        name: asset.fileName || `product_${Date.now()}_${index}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });
    }
  });

  const response = await client.post("/uploads/images", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  if (__DEV__) console.log("UPLOAD RESPONSE:", response.data);

  const data = response.data?.data || [];

  return data.map((item) => ({
    url: item.url,
    publicId: item.publicId || item.key,
  }));
};
