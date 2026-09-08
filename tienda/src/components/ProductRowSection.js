import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProductCard from "./ProductCard";
import { colors, shadows, spacing } from "../constants/theme";
import AppText from "./AppText";

// Diámetro del botón de flecha: 40px es cómodo para el ratón sin llegar a tapar
// la tarjeta que queda debajo.
const ARROW_SIZE = 40;

// Tolerancia en píxeles para decidir si todavía queda carril por recorrer. El
// scroll del navegador devuelve decimales (zoom del navegador, pantallas HiDPI)
// y sin este margen la flecha derecha se quedaría encendida para siempre al
// llegar al final.
const EDGE_TOLERANCE = 4;

export default function ProductRowSection({
  title,
  products = [],
  onPressProduct,
  onAddToCart,
  addingProductId,
}) {
  // Los hooks van TODOS antes de cualquier return: antes se salía temprano con
  // la lista vacía y eso rompía el orden de hooks en cuanto una sección pasaba
  // de vacía a con productos (o al revés) tras cargar el backend.
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 800;

  // Las flechas son solo para el ratón: en móvil se desliza con el dedo y unas
  // flechas superpuestas únicamente estorban y tapan producto.
  const isWebDesktop = Platform.OS === "web" && width >= 800;

  const cardWidth = isSmallScreen ? 160 : 260;

  const scrollRef = useRef(null);

  // Las medidas del carril viven en una ref porque cambian en cada evento de
  // scroll y no deben provocar re-render; solo el encendido/apagado de las
  // flechas pasa por estado.
  const rail = useRef({ offset: 0, viewport: 0, content: 0 });
  const [arrows, setArrows] = useState({ left: false, right: false });

  // Decide qué flecha se dibuja: la izquierda solo si ya nos movimos del
  // principio, la derecha solo si queda contenido a la derecha.
  const syncArrows = useCallback(() => {
    const { offset, viewport, content } = rail.current;
    const left = offset > EDGE_TOLERANCE;
    const right = content - viewport - offset > EDGE_TOLERANCE;
    // Se compara antes de setear para no re-renderizar en cada tick del scroll.
    setArrows((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  // react-native-web entrega contentOffset/contentSize/layoutMeasurement como
  // getters sobre el nodo del DOM, así que hay que leerlos aquí y no guardarse
  // el evento.
  const handleScroll = useCallback(
    (e) => {
      const n = e?.nativeEvent;
      if (!n) return;
      rail.current = {
        offset: n.contentOffset?.x ?? 0,
        viewport: n.layoutMeasurement?.width ?? rail.current.viewport,
        content: n.contentSize?.width ?? rail.current.content,
      };
      syncArrows();
    },
    [syncArrows],
  );

  // Medida inicial del ancho visible: sin esto no sabríamos si hay desborde
  // hasta que el usuario mueva el carril.
  const handleLayout = useCallback(
    (e) => {
      rail.current.viewport = e?.nativeEvent?.layout?.width ?? 0;
      syncArrows();
    },
    [syncArrows],
  );

  // El ancho del contenido cambia al llegar los productos del backend o al
  // cambiar el tamaño de tarjeta por el corte responsive.
  const handleContentSizeChange = useCallback(
    (contentWidth) => {
      rail.current.content = contentWidth || 0;
      syncArrows();
    },
    [syncArrows],
  );

  const scrollByPage = useCallback(
    (direction) => {
      const { offset, viewport, content } = rail.current;
      // Se avanza una pantalla MENOS media tarjeta para que el producto del
      // borde siga a la vista: así se entiende que la fila continúa y no parece
      // que se hayan saltado artículos.
      const step = Math.max(viewport - cardWidth * 0.6, cardWidth);
      const maxOffset = Math.max(content - viewport, 0);
      const next = Math.min(Math.max(offset + direction * step, 0), maxOffset);

      scrollRef.current?.scrollTo?.({ x: next, animated: true });

      // El navegador emite onScroll durante el desplazamiento suave, pero se
      // adelanta el estado para que la flecha no parpadee al llegar al extremo.
      rail.current.offset = next;
      syncArrows();
    },
    [cardWidth, syncArrows],
  );

  const renderCard = (item, index) => (
    <View
      key={item._id}
      style={{
        width: cardWidth,
        marginRight: index === products.length - 1 ? 0 : spacing.md,
      }}
    >
      <ProductCard
        product={item}
        compact={!isSmallScreen}
        mini={isSmallScreen}
        onPress={() => onPressProduct(item)}
        onAddToCart={onAddToCart}
        adding={addingProductId === item._id}
      />
    </View>
  );

  const renderArrow = (side) => (
    <View
      // La columna ocupa todo el alto solo para centrar la flecha; con box-none
      // deja pasar el ratón y no bloquea la tarjeta que queda detrás.
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        justifyContent: "center",
        zIndex: 2,
      }}
    >
      <Pressable
        onPress={() => scrollByPage(side === "left" ? -1 : 1)}
        accessibilityRole="button"
        accessibilityLabel={
          side === "left" ? "Ver productos anteriores" : "Ver más productos"
        }
        style={({ pressed, hovered }) => ({
          width: ARROW_SIZE,
          height: ARROW_SIZE,
          borderRadius: ARROW_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          // Círculo blanco con sombra suave: el lima es acento, no fondo. El
          // chevron va en azul de marca, que sobre blanco rinde 10,2:1.
          backgroundColor:
            hovered || pressed ? colors.background : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.card,
          cursor: "pointer",
        })}
      >
        <Ionicons
          name={side === "left" ? "chevron-back" : "chevron-forward"}
          size={22}
          color={colors.primary}
        />
      </Pressable>
    </View>
  );

  if (!products.length) return null;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {!!title && (
        <AppText
          // El grosor va por `weight`: pedir 800 sobre Inter Regular, que es la
          // única cara de cuerpo cargada, hace que el navegador la engorde a la
          // fuerza. Montserrat Bold es la que el manual asigna a los títulos.
          weight="bold"
          style={{
            fontSize: 22,
            color: colors.text,
            marginBottom: 12,
          }}
        >
          {title}
        </AppText>
      )}

      {Platform.OS === "web" ? (
        // El contenedor relativo es el ancla de las flechas superpuestas.
        <View style={{ position: "relative" }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            // Fuera la barra de scroll: se veía tosca y en escritorio nadie la
            // usaba. Se navega con las flechas y, en móvil, con el dedo (el
            // arrastre táctil sigue funcionando igual).
            showsHorizontalScrollIndicator={false}
            // react-native-web no emite onScroll si el throttle es 0.
            scrollEventThrottle={16}
            onScroll={handleScroll}
            onLayout={handleLayout}
            onContentSizeChange={handleContentSizeChange}
            contentContainerStyle={{
              paddingHorizontal: 2,
              paddingRight: spacing.md,
            }}
            style={{ overflow: "auto" }}
          >
            {products.map((item, index) => renderCard(item, index))}
          </ScrollView>

          {isWebDesktop && arrows.left && renderArrow("left")}
          {isWebDesktop && arrows.right && renderArrow("right")}
        </View>
      ) : (
        <FlatList
          data={products}
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          keyExtractor={(item) => item._id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 2,
            paddingRight: spacing.md,
          }}
          renderItem={({ item, index }) => renderCard(item, index)}
        />
      )}
    </View>
  );
}
