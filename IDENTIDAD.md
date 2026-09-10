# Identidad visual de Cibox

Esta es la referencia **vigente**. El *Manual de Diseño Digital cibox.cl v1.0*
(mayo 2024) sigue siendo el documento de marca, pero es un PDF que no se puede
editar desde aquí y ya no coincide en todo con lo que está publicado. Donde los
dos digan cosas distintas, manda este archivo: vive junto al código y se corrige
en el mismo movimiento en que se corrige la tienda.

Los valores no se copian a mano en ninguna pantalla. Salen de:

- `tienda/src/constants/theme.js` — la tienda
- `bodega/src/brand.js` — el panel
- `backend/src/config/brand.js` — los correos y todo lo que pinta el servidor

---

## Colores

| | Hex | Para qué |
|---|---|---|
| Azul Cibox | `#004568` | Cabecera, titulares, botón secundario |
| Azul medio | `#006996` | Enlaces, estados sobre azul, hover |
| Azul navy | `#003D49` | Pies, fondos profundos, texto sobre lima |
| Verde lima | `#B6D900` | Acciones: botón primario, badges, precios |
| Lima claro | `#D2E51A` | Resaltados y el estado pulsado del lima |
| Blanco | `#FFFFFF` | Superficies |
| Gris muy claro | `#F5F6F7` | Fondo de la tienda |
| Gris oscuro | `#17202A` | Texto principal y **todo lo que va sobre lima** |

**El lima nunca lleva texto blanco.** Blanco sobre `#B6D900` rinde 1,9:1 y
desaparece; `#17202A` sobre el mismo lima da 10,1:1. La misma regla vale al
revés: el lima como *color de texto* sobre blanco se queda en 1,6:1, así que es
color de relleno, no de letra.

El lima se usa como fondo extenso en un solo sitio —la barra del menú—, y ahí
funciona porque encima va texto navy (8,7:1).

## Tipografía

**Poppins**, en tres pesos: `Poppins_400Regular`, `Poppins_600SemiBold`,
`Poppins_700Bold`.

> Cambió en septiembre de 2026. El manual v1.0 pide Montserrat para títulos e
> Inter para cuerpo; la tienda usa Poppins en todo.

El grosor se pide **siempre** con el prop `weight` de `AppText`, nunca con
`fontWeight` numérico. Poppins se carga cara por cara: un peso que no
corresponda a una cara cargada no trae una tipografía más gruesa — el navegador
engorda la que haya, y sale una negrita fingida de bordes sucios.

## La cabecera, en tres franjas

| Franja | Fondo | Texto |
|---|---|---|
| Servicio (ayuda, seguimiento, cuenta) | Blanco | Azul Cibox |
| Cabecera (logo, buscador, carrito) | Azul Cibox | Blanco |
| Menú | Lima | Azul navy |

Sobre la franja azul, el logo va en su versión para fondo oscuro
(`logo-cibox-blanco.png`: isotipo lima con la palabra en blanco).

**Todo lo que va sobre la franja azul va en blanco**, iconos incluidos. El gris
oscuro del cuerpo (`colors.text`) sobre el azul rinde 1,9:1 y desaparece; es el
mismo error dos veces —"Acceso/Registro" primero y el icono de Despensa después—
y sale siempre de invertir el fondo de una fila sin revisar qué quedaba encima.
El contador del carrito es la excepción de color: va en **lima con número
oscuro**, porque un globo azul sobre la franja azul no se ve nunca.

La cabecera necesita **aire por debajo**. El hero también es azul, y con solo la
franja lima del menú entre medio los dos bloques se leen como una sola mancha:
el hero arranca con 24 px de separación para que se vea el fondo gris y la
cabecera siga leyéndose como franja.

## Logotipo

Isotipo en **lima**; la palabra CIBOX cambia según el fondo:

- Fondo claro → `logo-cibox.png`, palabra en navy
- Fondo azul → `logo-cibox-blanco.png`, palabra en blanco

El manual declara *usos incorrectos*: cambiar sus colores, distorsionarlo y
cambiar su tipografía. Al encajarlo en una caja hay que usar `contain`, nunca
`cover`: recortar el isotipo entra en "distorsionar".

## Medidas

- Ancho máximo del contenido: **1200 px**, con 24 px de margen lateral.
- Espaciado, sistema de 8 puntos: 4, 8, 16, 24, 32, 40, 48.
- Tarjetas: radio 12 px, fondo blanco, sombra suave.
- Puntos de quiebre del manual: escritorio >1024, tablet 768–1024, móvil <768.
  **Ojo:** la tienda corta en 800 px entre el diseño de escritorio y el de
  teléfono. Es una diferencia consciente y sin resolver: mover el corte a 1024
  mandaría todas las tablets al diseño de teléfono, y el manual no dice qué
  diseño le toca a esa banda.

## Accesibilidad

Contraste mínimo **4,5:1** para texto y 3:1 para iconos (WCAG 2.1 AA), y 16 px
como mínimo en textos de lectura larga.

No basta con leerlo: conviene medirlo en pantalla. Los dos fallos que llegaron a
publicarse —el newsletter con texto blanco sobre blanco y la cabecera con
"Acceso/Registro" en 1,6:1— venían los dos de invertir un fondo y no revisar qué
texto quedaba encima.

## Secciones escondidas

`tienda/src/constants/seccionesOcultas.js` decide qué se ofrece en los menús. Lo
que está ahí no se borró: su pantalla y su ruta siguen vivas para quien tenga el
enlace, y vuelve al menú sacando su clave del conjunto.
