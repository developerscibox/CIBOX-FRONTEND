import { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../constants/theme";
import AppText from "./AppText";
import UnitPrice from "./UnitPrice";
// productTint ya no se usa: teñía el fondo del placeholder según la categoría y
// era la causa de que en una misma fila unas tarjetas se vieran verdosas y otras
// azuladas. Todas comparten ahora el mismo gris muy suave (colors.background).
import { getProductImage, productEmoji } from "../utils/productImage";
import useAuthStore from "../store/authStore";
import { addFavorite, removeFavorite } from "../services/favoriteService";
import { addItemToPantry } from "../services/pantryService";
import { showToast } from "../store/toastStore";

import brand from "../constants/brand";
export default function ProductCard({
  product,
  onPress,
  onAddToCart,
  compact = false,
  mini = false,
  adding = false,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [fav, setFav] = useState(Boolean(product?.is_favorite));
  const [cajas, setCajas] = useState(1);
  const [savingPantry, setSavingPantry] = useState(false);
  const token = useAuthStore((s) => s.token);

  // Sincroniza fav cuando la lista recicla la tarjeta con otro producto
  useEffect(() => {
    setFav(Boolean(product?.is_favorite));
  }, [product?._id]);

  const handleToggleFav = async () => {
    if (!token) {
      Alert.alert("Favoritos", "Inicia sesión para guardar favoritos");
      return;
    }
    const next = !fav;
    setFav(next); // optimista
    try {
      if (next) {
        await addFavorite(product?._id);
      } else {
        await removeFavorite(product?._id);
      }
    } catch (e) {
      setFav(!next); // revierte si falla
    }
  };

  // ── Precio por caja (Cibox vende por caja, no por unidad) ──
  const tiers = Array.isArray(product?.pricing?.tiers)
    ? product.pricing.tiers
    : [];
  const sortedTiers = [...tiers].sort(
    (a, b) => (a?.min_qty || 1) - (b?.min_qty || 1),
  );
  const unitTier =
    sortedTiers.find((t) => (t?.min_qty || 1) === 1) || sortedTiers[0] || null;
  const boxTier = sortedTiers[sortedTiers.length - 1] || unitTier; // mayor cantidad = caja
  // tier.price es POR UNIDAD; el precio total de la caja = price * min_qty.
  const boxUnitPrice = boxTier?.price ?? null;
  const boxQty = boxTier?.min_qty && boxTier.min_qty > 1 ? boxTier.min_qty : null;
  const boxTotal =
    boxQty && boxUnitPrice != null ? boxUnitPrice * boxQty : boxUnitPrice;
  const perUnit = boxQty ? boxUnitPrice : null; // c/u dentro de la caja
  const unitPrice = unitTier?.price ?? null;
  const boxLabel = boxTier?.label || (boxQty ? `Caja de ${boxQty} un` : "Por caja");
  // Un tramo por cantidad puede ser dos cosas distintas y la ficha tiene que
  // mostrarlas distinto: un PACK CERRADO que se vende junto (el precio grande es
  // el del pack) o un DESCUENTO POR VOLUMEN sobre el producto suelto (el precio
  // grande sigue siendo el de una unidad, y llevar más solo la abarata).
  // El rótulo del tramo lo distingue: "pack de N" contra "N o más"
  // (ver backend catalogo/precio.js).
  const esPackCerrado =
    !!boxQty && /^pack|^caja/i.test(String(boxTier?.label || "")) ;
  const esVolumen = !!boxQty && !esPackCerrado;
  const boxSavingsPct =
    unitPrice && boxUnitPrice && boxQty && unitPrice > boxUnitPrice
      ? Math.round((1 - boxUnitPrice / unitPrice) * 100)
      : 0;
  const hasPackTier = !!boxQty;

  // Cantidad a guardar en Mi Despensa: 1, igual que agregar al carrito.
  //
  // ANTES devolvía boxQty (el tamaño del pack) cuando el producto tenía uno, así
  // que "Guardar en despensa" de un producto con pack de 6 guardaba 6 unidades
  // sin decirlo, y de ahí pasaban 6 al carrito en "Recomprar todo". El pack es
  // un descuento por cantidad, no un mínimo de compra: ver utils/boxPricing.js,
  // cuyo boxQtyOf global ya devuelve 1 siempre. Esta copia local se había
  // quedado con la regla mayorista vieja.
  const pantryQtyOf = () => 1;

  // Guardar rápido en Mi Despensa. Autocontenido: no depende de props nuevas.
  const handleSaveToPantry = async () => {
    if (savingPantry) return;
    if (!token) {
      showToast("Inicia sesión para usar tu despensa", "info");
      return;
    }
    try {
      setSavingPantry(true);
      await addItemToPantry({
        productId: product?._id,
        quantity: pantryQtyOf(),
      });
      showToast("Guardado en Mi Despensa");
    } catch (e) {
      showToast(
        e?.response?.data?.message || "No se pudo guardar en tu despensa",
        "error",
      );
    } finally {
      setSavingPantry(false);
    }
  };

  const averageRating = Number(product?.average_rating ?? 0);
  const reviewsCount = Number(product?.reviews_count ?? 0);
  const hasReviews = reviewsCount > 0;

  const ciboxPlusEnabled = !!product?.cibox_plus?.enabled;
  const imageUrl = imgFailed ? null : getProductImage(product);

  const formatPrice = (value) => {
    if (value === null || value === undefined) return "—";
    return `$${Number(value).toLocaleString("es-CL")}`;
  };

  // Tamaños según modo
  const imageHeight = mini ? 120 : compact ? 180 : 220;
  const titleSize = mini ? 13 : compact ? 16 : 17;
  const priceSize = mini ? 15 : compact ? 18 : 20;
  const cardPadding = mini ? spacing.sm : spacing.md;

  // ── Alturas reservadas ──────────────────────────────────────────────────────
  // Todas las tarjetas de una fila deben medir lo mismo y el botón "Agregar"
  // quedar siempre a la misma altura. Antes cada zona crecía según el contenido
  // (badge sí / badge no, nombre de una o dos líneas) y las filas quedaban en
  // escalera. Ahora las zonas de arriba tienen altura FIJA y el sobrante se lo
  // come el espaciador que hay antes del pie.
  const badgeRowHeight = mini ? 22 : 30; // se reserva exista badge o no
  const titleLineHeight = mini ? 18 : 22;
  const titleBlockHeight = titleLineHeight * 2; // siempre dos líneas de nombre
  // Franja del precio anterior. Se reserva SIEMPRE, tenga descuento o no: si
  // solo apareciera en las rebajadas, las tarjetas de una misma fila volverían
  // a quedar en escalera, que es justo lo que arregla el bloque de arriba.
  const comparePriceHeight = mini ? 16 : 19;

  // Precio anterior (punto 08 del manual: "precio actual y precio anterior").
  // El dato es por unidad; para el precio de caja hay que multiplicarlo por las
  // unidades que trae, o el tachado quedaría comparando caja contra unidad.
  const precioVigente = esVolumen ? unitPrice : boxTotal;
  const comparaUnidad = Number(product?.compare_price || 0);
  const comparaTotal = esVolumen ? comparaUnidad : comparaUnidad * (boxQty || 1);
  const hayDescuento =
    comparaUnidad > 0 && precioVigente > 0 && comparaTotal > precioVigente;
  const descuentoPct = hayDescuento
    ? Math.round((1 - precioVigente / comparaTotal) * 100)
    : 0;

  const chipStyle = (backgroundColor) => ({
    backgroundColor,
    paddingHorizontal: mini ? 6 : 10,
    paddingVertical: mini ? 3 : 5,
    borderRadius: 999,
    marginRight: 6,
    // sin marginBottom: la fila de badges ya no envuelve, tiene altura fija
    //
    // flexShrink deja que los badges se APRIETEN si no caben los dos. En la
    // grilla de 6 columnas la tarjeta mide ~200px y "Venta por caja" + "Cibox+"
    // se pasan del ancho; como la fila no envuelve y recorta, el segundo badge
    // aparecía cortado por la mitad. Encogiendo, el texto se corta con puntos
    // suspensivos (numberOfLines={1}) y el badge se sigue viendo entero.
    flexShrink: 1,
  });

  return (
    <View
      style={{
        // overflow:hidden FUERZA a Chrome a re-pintar el fondo blanco en TODA la
        // caja (capa de composición propia). Sin esto, con el flex anidado del
        // carrusel el fondo se pintaba corto y "Ver detalle/Guardar" quedaba sobre
        // el rosado, aunque la caja sí incluyera el footer.
        width: "100%",
        overflow: "hidden",
        // flexGrow con base automática: la tarjeta parte midiendo su contenido
        // (así la fila calcula bien su alto) y luego se estira hasta el alto de
        // la fila. NO se usa `flex: 1` porque eso pone flexBasis en 0 y, dentro
        // de un contenedor de alto automático, Yoga colapsa la tarjeta a cero.
        flexGrow: 1,
        flexBasis: "auto",
        // Colores base idénticos en TODAS las tarjetas: blanco, borde de marca,
        // radio 12 y la misma sombra (Manual de Diseño Digital, punto de tarjetas).
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: cardPadding,
        ...shadows.card,
      }}
    >
      {/* El bloque pinchable crece con la tarjeta: así el hueco que queda cuando
          esta tarjeta tiene menos texto que su vecina sigue abriendo el detalle
          y no se convierte en una zona muerta. */}
      <Pressable onPress={onPress} style={{ flexGrow: 1 }}>
        {/* Imagen — alto FIJO por modo, con imagen o sin ella */}
        <View
          style={{
            width: "100%",
            height: imageHeight,
            borderRadius: radius.lg,
            // Mismo gris muy suave para todos los productos: haya foto o no, el
            // recuadro se ve igual. El tinte por categoría era lo que pintaba
            // unas tarjetas verdosas y otras azuladas dentro de la misma fila.
            backgroundColor: colors.background,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: mini ? 8 : spacing.md,
          }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
              }}
            >
              <AppText style={{ fontSize: mini ? 40 : 58, marginBottom: 6 }}>
                {productEmoji(product)}
              </AppText>
              <AppText
                numberOfLines={2}
                weight="semiBold"
                style={{
                  // Antes era colors.text al 70% de opacidad; el gris medio de
                  // marca da el mismo peso visual y un contraste medible
                  // (5,42:1 sobre el gris del recuadro).
                  color: colors.muted,
                  fontSize: mini ? 11 : 13,
                  textAlign: "center",
                }}
              >
                {product?.name || product?.category?.name || brand.name}
              </AppText>
            </View>
          )}

          {/* Botón favorito (corazón) */}
          <Pressable
            onPress={handleToggleFav}
            hitSlop={8}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "rgba(255,255,255,0.85)",
              alignItems: "center",
              justifyContent: "center",
              ...shadows.card,
            }}
          >
            <Ionicons
              name={fav ? "heart" : "heart-outline"}
              size={20}
              color={fav ? colors.primary : colors.text}
            />
          </Pressable>
        </View>

        {/* Zona de badges — se dibuja SIEMPRE, tenga o no badges el producto.
            Es la clave para que la tarjeta con promoción y la que no la tiene
            midan igual. La fila no envuelve (los badges son cortos) para que su
            altura no dependa de cuántos haya. */}
        {!mini && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              height: badgeRowHeight,
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            {hasPackTier ? (
              // Lima = color de ACCIÓN de la marca, con texto oscuro encima
              // (sobre lima el blanco rinde 1,9:1 y no pasa AA).
              <View style={chipStyle(colors.accent)}>
                <AppText numberOfLines={1} weight="bold" style={{ color: colors.accentText, fontSize: 11 }}>
                  {esPackCerrado ? "Venta por caja" : `Ahorra desde ${boxQty}`}
                </AppText>
              </View>
            ) : null}
            {ciboxPlusEnabled ? (
              // Cibox+ va en azul de marca y no en lima: dos badges lima pegados
              // se leerían como uno solo, y el azul es la base de la identidad.
              <View style={chipStyle(colors.primary)}>
                <AppText numberOfLines={1} weight="bold" style={{ color: colors.primaryText, fontSize: 11 }}>
                  Cibox+
                </AppText>
              </View>
            ) : null}
          </View>
        )}

        {/* Chips mini — misma reserva de altura, textos abreviados */}
        {mini && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              height: badgeRowHeight,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            {hasPackTier && (
              <View style={chipStyle(colors.accent)}>
                <AppText numberOfLines={1} weight="bold" style={{ color: colors.accentText, fontSize: 10 }}>
                  {esPackCerrado ? "Por caja" : `${boxQty}+`}
                </AppText>
              </View>
            )}
            {ciboxPlusEnabled && (
              <View style={chipStyle(colors.primary)}>
                <AppText numberOfLines={1} weight="bold" style={{ color: colors.primaryText, fontSize: 10 }}>
                  Cibox+
                </AppText>
              </View>
            )}
          </View>
        )}

        {/* Nombre — alto reservado para DOS líneas siempre, aunque el nombre
            ocupe una. Si no, la tarjeta de nombre corto subía todo lo de abajo. */}
        <View style={{ height: titleBlockHeight, marginBottom: 6 }}>
          <AppText
            numberOfLines={2}
            weight="bold"
            style={{
              fontSize: titleSize,
              color: colors.text,
              lineHeight: titleLineHeight,
            }}
          >
            {product?.name || "Producto"}
          </AppText>
        </View>

        {/* Precio por caja */}
        <View style={{ marginBottom: 4 }}>
          {/* Precio anterior tachado + cuánto se rebaja. La franja existe
              siempre para que todas las tarjetas midan igual; cuando no hay
              descuento se queda vacía. */}
          <View style={{ height: comparePriceHeight, flexDirection: "row", alignItems: "center", gap: 6 }}>
            {hayDescuento && (
              <>
                <AppText
                  numberOfLines={1}
                  style={{
                    fontSize: mini ? 11 : 13,
                    color: colors.muted,
                    textDecorationLine: "line-through",
                  }}
                >
                  {formatPrice(comparaTotal)}
                </AppText>
                {/* El descuento es lo que hay que mirar: lima de acento con
                    texto oscuro encima, el mismo patrón que la ficha. */}
                <View style={chipStyle(colors.accent)}>
                  <AppText weight="bold" style={{ color: colors.accentText, fontSize: mini ? 10 : 11 }}>
                    -{descuentoPct}%
                  </AppText>
                </View>
              </>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <AppText
              weight="bold"
              style={{ fontSize: priceSize, color: colors.text }}
            >
              {formatPrice(esVolumen ? unitPrice : boxTotal)}
            </AppText>
            <AppText
              weight="semiBold"
              style={{
                // El sufijo iba en lima sobre blanco: 1,68:1, ilegible. El lima
                // es color de RELLENO (botón, badge), no de texto sobre blanco.
                fontSize: mini ? 11 : 13,
                color: colors.muted,
              }}
            >
              {esPackCerrado ? "/ caja" : "/ un"}
            </AppText>
          </View>

          {/* PPUM (decreto 38/2024, art. 9°): junto al precio, mismo campo visual. */}
          <UnitPrice product={product} unitPrice={esVolumen ? unitPrice : boxUnitPrice} priceSize={priceSize} />

          <AppText
            style={{ fontSize: mini ? 10 : 12, color: colors.muted, marginTop: 1 }}
          >
            {esVolumen ? `${boxQty} o más · ${formatPrice(perUnit)} c/u` : boxLabel}
            {!esVolumen && perUnit ? ` · ≈ ${formatPrice(perUnit)} c/u` : ""}
          </AppText>

          {boxSavingsPct >= 3 && (
            <AppText
              weight="semiBold"
              style={{
                fontSize: mini ? 10 : 12,
                color: colors.success,
                marginTop: 2,
              }}
            >
              Ahorra {boxSavingsPct}% {esVolumen ? `llevando ${boxQty} o más` : "por caja"}
            </AppText>
          )}
        </View>

        {/* Categoría */}
        <View style={{ marginBottom: mini ? 6 : 6 }}>
          <AppText
            numberOfLines={1}
            style={{ color: colors.muted, fontSize: mini ? 12 : 14 }}
          >
            {product?.category?.name || "Sin categoría"}
          </AppText>
        </View>

        {/* Reseñas — ocultas en mini */}
        {!mini && (
          <View style={{ marginBottom: 14 }}>
            {hasReviews ? (
              /* Aquí quedaba un fontWeight "600" suelto sobre la familia
                 regular: solo está cargada Inter_400Regular, así que el
                 navegador la engordaba él mismo (negrita sintética, de bordes
                 sucios). Pasa al prop de AppText como el resto del archivo. */
              <AppText weight="semiBold" style={{ color: colors.muted, fontSize: 12 }}>
                {averageRating.toFixed(1)} · {reviewsCount} reseñas
              </AppText>
            ) : (
              <AppText style={{ color: colors.muted, fontSize: 12 }}>
                Aún sin reseñas
              </AppText>
            )}
          </View>
        )}
      </Pressable>

      {/* Espaciador: se come la diferencia de alto entre una tarjeta y otra
          (nombre corto, sin PPUM, sin ahorro...) y deja el pie pegado abajo.
          Sin él, el botón "Agregar" quedaba a distinta altura en cada tarjeta y
          la fila se veía en escalera. */}
      <View style={{ flexGrow: 1, minHeight: mini ? 4 : 6 }} />

      {/* Botones — fondo blanco PROPIO que sangra a los bordes de la card. Así,
          aunque el fondo del root se pintara corto en el carrusel, este bloque
          (stepper + agregar caja + Ver detalle/Guardar) SIEMPRE queda sobre
          blanco. El overflow:hidden + radius del root le redondea las esquinas.
          Va al final del eje, después del espaciador: el botón "Agregar" queda
          SIEMPRE a la misma distancia del borde inferior en todas las tarjetas.
          El selector de cajas, cuando existe, crece hacia arriba y no lo mueve. */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: mini ? 8 : 12,
          gap: mini ? 6 : 10,
          backgroundColor: colors.surface,
          marginHorizontal: -cardPadding,
          marginBottom: -cardPadding,
          paddingHorizontal: cardPadding,
          paddingBottom: cardPadding,
        }}
      >
        {/* Selector de cajas — solo con pack tier y fuera de modo mini */}
        {hasPackTier && !mini && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              marginBottom: 4,
            }}
          >
            <Pressable
              onPress={() => setCajas((n) => Math.max(1, n - 1))}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
              }}
            >
              <AppText weight="bold" style={{ fontSize: 20, color: colors.text }}>
                −
              </AppText>
            </Pressable>
            <AppText
              weight="bold"
              style={{
                fontSize: 16,
                color: colors.text,
                minWidth: 24,
                textAlign: "center",
              }}
            >
              {cajas}
            </AppText>
            <Pressable
              onPress={() => setCajas((n) => n + 1)}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
              }}
            >
              <AppText weight="bold" style={{ fontSize: 20, color: colors.text }}>
                +
              </AppText>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={async () => {
            // Agrega siempre, tenga o no formato de caja.
            //
            // ANTES: si el producto no tenía tramo de pack, el botón no agregaba
            // nada y solo navegaba al detalle. Era una regla de cuando Cibox
            // vendía solo por caja; al pasar a venta por unidad (ver
            // utils/boxPricing.js, que documenta el cambio) quedó viva y dejó el
            // botón muerto en TODO el catálogo: los 763 productos tienen un solo
            // tramo min_qty:1, así que hasPackTier era false en todos. De paso
            // volvía código muerto la puerta de edad de alcohol, que vive dentro
            // de los handleAddFromCard de las pantallas.
            try {
              await onAddToCart?.(product, cajas);
              setCajas(1); // resetea el selector tras agregar exitoso
            } catch (e) {
              // si falla, no reseteamos el selector
            }
          }}
          disabled={adding}
          style={{
            // Botón principal = lima, el color de ACCIÓN de la marca, con texto
            // oscuro encima (accentText). Mientras agrega NO se baja la opacidad:
            // al 70% el par texto/fondo caía a 4,29:1 y dejaba de cumplir AA; se
            // cambia al lima claro (accentLight), que es el tono de resalte del
            // manual y mantiene 11,7:1.
            backgroundColor: adding ? colors.accentLight : colors.accent,
            height: mini ? 34 : 42,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppText
            weight="bold"
            style={{ color: colors.accentText, fontSize: mini ? 12 : 14 }}
          >
            {adding
              ? "Agregando..."
              : cajas > 1
                ? `Agregar ${cajas}`
                : "Agregar"}
          </AppText>
        </Pressable>

        {!mini && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 20,
            }}
          >
            {/* "Ver detalle" se quitó: pinchar la tarjeta ya abre el detalle.
                Queda solo "Guardar en despensa", que es una acción distinta. */}
            <Pressable
              onPress={handleSaveToPantry}
              disabled={savingPantry}
              hitSlop={6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              {/* Mientras guarda se cambia el COLOR en vez de bajar la opacidad:
                  el azul al 60% sobre blanco caía a 3,48:1 y no cumplía AA; el
                  gris medio de marca marca igual el estado y rinde 5,87:1. */}
              <Ionicons
                name="bookmark-outline"
                size={16}
                color={savingPantry ? colors.muted : colors.primary}
              />
              <AppText
                weight="semiBold"
                style={{ color: savingPantry ? colors.muted : colors.primary, fontSize: 13 }}
              >
                {savingPantry ? "Guardando..." : "Guardar en despensa"}
              </AppText>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}