# Plan de incentivos PILOTO — vendedores (referencia, modificable)

> Simple, claro y **trazable**: cada punto sale de pedidos reales del vendedor.
> Todo es modificable después (los valores viven en `backend/src/incentivos/piloto.js`).

## Objetivo
Premiar a los vendedores por **volumen** (unidades vendidas) y por **facturación** ($),
sin fórmulas raras, para arrancar y ajustar sobre la marcha.

## Reglas (valores por defecto)
- **1 punto por cada unidad vendida.**
- **1 punto por cada $1.000 vendidos.**
- **Puntos del periodo = unidades + (venta en $ ÷ 1.000).**
- (Opcional, apagado por defecto) **bono** de N puntos por superar una meta de venta del periodo.
- Periodo: el que elijas en el Centro de mando (hoy / 7 días / 30 días / trimestre).

### Ejemplo
Un vendedor con **320 unidades** y **$4.128.000** vendidos:
`320 (unidades) + 4.128 ($4.128.000 ÷ 1.000) = 4.448 puntos.`

## Trazabilidad (cómo se audita)
Los puntos no son un número suelto: se calculan desde los **pedidos entregados atribuidos
al vendedor** (la etapa "toma" del relay registra quién tomó cada pedido). Por eso:
- En **Centro de mando → Incentivos** se ve el ranking con el desglose: unidades, $ vendido,
  puntos por unidad, puntos por $, total.
- En **Centro de mando → Trazabilidad** se puede abrir cualquier pedido y ver quién lo tomó,
  con sus ítems y montos → de ahí salen los puntos. 100% auditable.

## Cómo se modifica
Hoy los valores están en `DEFAULT_PILOTO` (`backend/src/incentivos/piloto.js`):
```
puntosPorUnidad: 1,   // puntos por unidad
puntosPorMilCLP: 1,   // puntos por cada $1.000
bonoMetaCLP: 0,       // meta de venta para bono (0 = sin bono)
bonoPuntos: 0,        // puntos del bono
```
Cambiar cualquiera ajusta el cálculo en todo el tablero. Próximo paso (cuando quieras):
una pantalla de **Configuración** para editar estos valores sin tocar código, junto con
las **metas** de caja y el **margen objetivo**.

## Pendiente de negocio (tu decisión)
- **Valor del punto / premio:** define a qué equivale un punto (ej. canje por bono, premio,
  o $ por punto). El piloto acumula y rankea; el premio se define arriba.
- ¿Puntos por **unidad** o por **caja**? Hoy es por **unidad** (lo más granular). Se puede cambiar.
- ¿Aplica también a cajeras/bodegueros? El piloto parte por **vendedores**; el mismo motor
  sirve para sumar metas de otros roles después.
