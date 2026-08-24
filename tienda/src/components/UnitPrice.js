// src/components/UnitPrice.js
//
// Precio por Unidad de Medida (PPUM) — decreto supremo N° 38 de 2024 del
// Ministerio de Economía, vigente desde el 10-09-2025. Reemplazó al decreto
// 229 de 2002 y aplica a las plataformas de comercio electrónico, no solo a la
// sala de ventas.
//
// Reglas del art. 9° que este componente hace cumplir:
//  - "Siempre que se informe el Precio de venta, este se deberá indicar junto
//    con el Precio por unidad de medida" → va pegado al precio, en el mismo
//    campo visual. Nunca detrás de un hover, un tooltip ni un acordeón.
//  - El texto es "$[precio] por [unidad de medida]".
//  - En plataformas, la altura de los caracteres del PPUM no puede ser inferior
//    al 50% de la del precio de venta → de ahí `RATIO_MINIMO_LEGAL`.
//
// Si el producto no tiene PPUM calculable o está exceptuado (art. 8°), el
// backend manda el texto vacío y aquí no se dibuja nada: nunca se publica un
// precio por unidad falso o a medias.

import AppText from "./AppText";
import { colors } from "../constants/theme";

// Art. 9°: mínimo legal 50% del tamaño del precio de venta. Se usa 60% para no
// quedar pegado al límite por redondeos de fuente en distintas pantallas.
const RATIO_MINIMO_LEGAL = 0.5;
const RATIO = 0.6;
const TAMANO_MINIMO = 11;

// Mismo redondeo que backend/src/catalogo/ppum.js. El decreto no lo regula.
const redondear = (valor) => (valor < 10 ? Math.round(valor * 10) / 10 : Math.round(valor));

const formatear = (valor, etiqueta) => `$${Number(valor).toLocaleString("es-CL")} por ${etiqueta}`;

/**
 * Texto del PPUM.
 *
 * El PPUM es lineal en el precio, así que cuando la pantalla muestra un precio
 * distinto al de lista —el precio unitario dentro de un pack, o uno con
 * descuento— basta reescalar el valor que ya calculó el backend. Si no se
 * reescalara, la tarjeta de un pack mostraría el precio del pack junto al PPUM
 * del producto suelto, que es justo la comparación que el decreto busca evitar.
 *
 * @param {object|string} source     Producto, ítem de carrito o el texto directo.
 * @param {number} [unitPrice]       Precio por unidad al que corresponde el
 *                                   precio de venta que se está mostrando.
 */
export const unitPriceText = (source, unitPrice) => {
  if (typeof source === "string") return source;

  const propio = source?.ppum_label || "";
  if (propio) return propio;

  const ppum = source?.ppum;
  if (!ppum?.text) return "";

  const base = Number(source?.price) || 0;
  const cobrado = Number(unitPrice) || 0;
  if (!base || !cobrado || cobrado === base) return ppum.text;

  return formatear(redondear((Number(ppum.value) || 0) * (cobrado / base)), ppum.unit_label);
};

/**
 * @param {object}  props
 * @param {object|string} props.product   Producto del catálogo, ítem de carrito
 *                                        o directamente el texto del PPUM.
 * @param {number}  [props.unitPrice]     Precio unitario efectivo, si difiere
 *                                        del de lista (pack, descuento).
 * @param {number}  props.priceSize       Tamaño de fuente del precio de venta
 *                                        que acompaña. Define el mínimo legal.
 * @param {object}  [props.style]         Estilos extra del texto.
 */
export default function UnitPrice({ product, unitPrice, priceSize = 18, style }) {
  const texto = unitPriceText(product, unitPrice);
  if (!texto) return null;

  const fontSize = Math.max(
    TAMANO_MINIMO,
    Math.round(priceSize * RATIO),
    Math.ceil(priceSize * RATIO_MINIMO_LEGAL),
  );

  return (
    <AppText
      accessibilityLabel={`Precio por unidad de medida: ${texto}`}
      style={[
        {
          fontSize,
          color: colors.muted,
          fontWeight: "600",
          marginTop: 2,
        },
        style,
      ]}
    >
      {texto}
    </AppText>
  );
}
