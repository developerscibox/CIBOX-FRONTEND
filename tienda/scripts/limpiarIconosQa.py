#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Limpia y recomprime los iconos de accesos rapidos (qa-*.png) de la home.

POR QUE EXISTE ESTE SCRIPT
--------------------------
Los artes que entrega diseno vienen recortados como un RECTANGULO en vez de seguir la
silueta de la teja verde redondeada, asi que arrastran un marco casi-blanco pegado detras
del dibujo. Sobre las tarjetas blancas de la grilla ese marco tiene contraste cero y es
invisible, pero sobre la franja verde del newsletter (HomeScreen.js) el icono se ve como
una calcomania recortada con tijera.

La correccion NO puede ser "reemplazar todo lo blanco por transparente": las lineas del
dibujo tambien son blancas y quedarian perforadas. Por eso el borrado se hace por
CONTIGUIDAD (relleno tipo bote de pintura desde el borde del lienzo hacia adentro), que
solo alcanza el marco exterior y nunca los blancos encerrados por el verde de la teja.

Se deja como script y no como edicion manual porque diseno reentrega estos artes cada vez
que cambia un icono, y el defecto vuelve a aparecer en cada entrega.

DOS DETALLES QUE PARECEN MENORES Y NO LO SON
--------------------------------------------
1. El "blanco" del marco no es blanco puro: el original venia comprimido con perdida y
   dejo un residuo rosado (se midieron pixeles hasta (248,224,240)). Una comparacion
   exacta contra #FFFFFF no lo detecta, por eso se compara con tolerancia cromatica.
2. El borde de la teja esta suavizado (antialias) CONTRA ese marco blanco. Si solo se
   borran los pixeles blancos, queda un anillo de pixeles opacos verde-blanquecinos que
   sobre fondo verde se ven como un halo claro y dentado. Por eso, en la banda de
   transicion, se recupera la cobertura real del pixel resolviendo la mezcla
   C = a*F + (1-a)*BLANCO y se reescribe como verde de la teja con alfa parcial.

USO
---
    python tienda/scripts/limpiarIconosQa.py                 # procesa los 7 iconos in situ
    python tienda/scripts/limpiarIconosQa.py ruta/al/icono.png ...
    python tienda/scripts/limpiarIconosQa.py --sin-recomprimir
"""

import os
import sys
from collections import deque

from PIL import Image, ImageChops, ImageStat

# --- Umbrales de deteccion del fondo -------------------------------------------------
# Un pixel cuenta como fondo si ya es transparente o si es "casi blanco". El margen es
# generoso a proposito para tragar el residuo rosado de la compresion original, pero
# sigue muy lejos del verde de la teja (el mas claro medido es (177,213,89), con un canal
# minimo de 89), asi que no hay riesgo de comerse el dibujo.
ALFA_TRANSPARENTE = 12      # por debajo de esto el pixel ya no pinta nada
CANAL_MINIMO_BLANCO = 200   # el canal mas oscuro de un pixel del marco
# Con 40 quedaban 39 pixeles rosados sueltos en el contorno de los 7 iconos: el residuo
# mas saturado que dejo la compresion llega a (250,209,230), o sea 41 de diferencia entre
# canales. Se sube a 60 para taparlo. Sigue sin tocar la teja, cuyo canal mas oscuro anda
# en 81-89: para que un verde de teja entrara aqui tendria que aclararse mas de 110 tonos.
DESVIO_MAXIMO_BLANCO = 60   # diferencia maxima entre canales (tolera el tinte rosado)
CANAL_MAXIMO_TEJA = 170     # un pixel mas claro que esto no sirve como muestra de teja

# --- Umbrales de la banda de antialias -----------------------------------------------
RADIO_BANDA = 2             # ancho en px de la zona de transicion a reconstruir
RADIO_BUSQUEDA_TEJA = 5     # hasta donde buscar un pixel de teja que sirva de referencia
CONTRASTE_MINIMO = 25       # distancia minima al blanco para que el canal sea confiable
# Un pixel con cobertura practicamente total no es mezcla: esta dentro de la teja y solo
# cayo en la banda por cercania. Reescribirlo con el color del vecino le aplanaba el
# degradado, asi que por encima de este umbral se deja exactamente como estaba.
COBERTURA_INTACTA = 0.99

# --- Recompresion ---------------------------------------------------------------------
# Arte plano de menos de 1200 tonos: una paleta indexada pesa bastante menos que el RGBA
# sin perdida visible. Se prueban tamanos de paleta de mayor a menor y se elige el mas
# chico que todavia pasa el control de calidad, en vez de fijar un numero a ciegas.
PALETAS_CANDIDATAS = (256, 224, 192, 160, 128, 96, 64)
# Umbrales calibrados mirando el mapa de diferencias amplificado x24 contra el original:
# hasta 128 colores el error vive solo en el filo de las lineas del dibujo (inevitable al
# indexar antialias), pero de 96 hacia abajo se encienden AREAS enteras de la teja, que es
# la firma del bandeo en el degradado. De ahi salen estos dos numeros.
ERROR_MAXIMO_PIXEL = 12     # error de canal tolerado sobre fondo compuesto
ERROR_MEDIO_MAXIMO = 0.55   # RMSE tolerado (es el que delata el bandeo del degradado)
PESO_ALFA_PALETA = 2.0      # el alfa pesa doble al cortar cajas: mezclar niveles de
                            # transparencia dienta el borde mas de lo que molesta un tono

VERDE_MARCA = (62, 125, 30)  # primaryDark #3E7D1E: el peor fondo para un halo blanco

ICONOS_POR_DEFECTO = (
    "qa-beneficios.png",
    "qa-despacho-pronto.png",
    "qa-liquidacion.png",
    "qa-mas-vendido.png",
    "qa-mi-despensa.png",
    "qa-news.png",
    "qa-sigue-tu-pedido.png",
)


def es_casi_blanco(pixel):
    """True si el pixel pertenece al marco: claro en los tres canales y sin dominante."""
    r, g, b = pixel[0], pixel[1], pixel[2]
    return min(r, g, b) >= CANAL_MINIMO_BLANCO and (max(r, g, b) - min(r, g, b)) <= DESVIO_MAXIMO_BLANCO


def es_fondo(pixel):
    """Fondo = margen ya transparente, o marco casi blanco (opaco o semitransparente)."""
    if pixel[3] <= ALFA_TRANSPARENTE:
        return True
    return es_casi_blanco(pixel)


def marcar_fondo_exterior(pixeles, ancho, alto):
    """
    Relleno por contiguidad desde todo el perimetro del lienzo hacia adentro.

    Se siembra desde el borde completo y no solo desde las cuatro esquinas: es la misma
    region conectada, pero asi sigue funcionando si un arte futuro llega con la teja
    pegada a una esquina. Lo importante es que solo avanza por pixeles vecinos, de modo
    que los blancos encerrados por el verde (las lineas del dibujo) son inalcanzables.
    """
    fondo = bytearray(ancho * alto)
    cola = deque()

    def sembrar(x, y):
        i = y * ancho + x
        if not fondo[i] and es_fondo(pixeles[i]):
            fondo[i] = 1
            cola.append((x, y))

    for x in range(ancho):
        sembrar(x, 0)
        sembrar(x, alto - 1)
    for y in range(alto):
        sembrar(0, y)
        sembrar(ancho - 1, y)

    while cola:
        x, y = cola.popleft()
        if x > 0:
            sembrar(x - 1, y)
        if x < ancho - 1:
            sembrar(x + 1, y)
        if y > 0:
            sembrar(x, y - 1)
        if y < alto - 1:
            sembrar(x, y + 1)

    return fondo


def buscar_color_teja(pixeles, fondo, ancho, alto, cx, cy):
    """
    Color de referencia para reconstruir un pixel del borde: el pixel de teja opaco mas
    cercano. Se exige que NO sea casi blanco, porque si la referencia fuera una linea
    blanca del dibujo la ecuacion de mezcla se indetermina (blanco sobre blanco), y ademas
    que sea francamente oscuro: tomar como referencia un pixel de residuo claro daba
    cobertura 1.0 y dejaba el propio residuo intacto en el contorno.
    """
    for radio in range(1, RADIO_BUSQUEDA_TEJA + 1):
        mejor = None
        for dy in range(-radio, radio + 1):
            for dx in range(-radio, radio + 1):
                if max(abs(dx), abs(dy)) != radio:
                    continue  # solo el anillo nuevo de este radio
                x, y = cx + dx, cy + dy
                if not (0 <= x < ancho and 0 <= y < alto):
                    continue
                i = y * ancho + x
                if fondo[i]:
                    continue
                pixel = pixeles[i]
                if pixel[3] < 250 or es_casi_blanco(pixel):
                    continue
                if min(pixel[0], pixel[1], pixel[2]) > CANAL_MAXIMO_TEJA:
                    continue  # claro de mas: es linea del dibujo o residuo, no teja
                if mejor is None:
                    mejor = pixel
        if mejor is not None:
            return mejor
    return None


def reconstruir_borde(pixeles, fondo, ancho, alto):
    """
    Devuelve la lista de pixeles finales.

    En la banda pegada al fondo, el pixel observado es una mezcla del verde de la teja con
    el blanco del marco que acabamos de borrar. Se despeja la cobertura 'a' de
    C = a*F + (1-a)*255 por minimos cuadrados sobre los tres canales (cada canal pesa
    segun cuanto separa a F del blanco, asi el azul manda en el verde de la teja y el
    resultado no depende de un canal poco informativo). El pixel se reescribe con el color
    de la teja y ese alfa: el borde queda suave en vez de dentado.
    """
    salida = list(pixeles)

    for y in range(alto):
        for x in range(ancho):
            i = y * ancho + x
            if fondo[i]:
                salida[i] = (0, 0, 0, 0)
                continue

            # Solo interesan los pixeles a un paso del fondo recien borrado.
            vecino_de_fondo = False
            for dy in range(-RADIO_BANDA, RADIO_BANDA + 1):
                for dx in range(-RADIO_BANDA, RADIO_BANDA + 1):
                    vx, vy = x + dx, y + dy
                    if 0 <= vx < ancho and 0 <= vy < alto and fondo[vy * ancho + vx]:
                        vecino_de_fondo = True
                        break
                if vecino_de_fondo:
                    break
            if not vecino_de_fondo:
                continue

            teja = buscar_color_teja(pixeles, fondo, ancho, alto, x, y)
            if teja is None:
                continue  # sin referencia fiable: mejor dejarlo tal cual que inventarlo

            actual = pixeles[i]
            numerador = 0.0
            denominador = 0.0
            for canal in range(3):
                separacion = 255 - teja[canal]
                if separacion < CONTRASTE_MINIMO:
                    continue
                numerador += separacion * (255 - actual[canal])
                denominador += separacion * separacion
            if denominador == 0:
                continue

            cobertura = numerador / denominador
            if cobertura >= COBERTURA_INTACTA:
                continue  # el pixel esta entero dentro de la teja: no se toca su color
            cobertura = max(0.0, min(1.0, cobertura))
            alfa = int(round(cobertura * actual[3]))
            if alfa <= 0:
                salida[i] = (0, 0, 0, 0)
            else:
                salida[i] = (teja[0], teja[1], teja[2], alfa)

    return salida


def componer_sobre(imagen, fondo_rgb):
    """Aplana el RGBA sobre un color liso. Es como lo ve el usuario en la app."""
    lienzo = Image.new("RGBA", imagen.size, fondo_rgb + (255,))
    lienzo.alpha_composite(imagen)
    return lienzo.convert("RGB")


def medir_diferencia(a, b):
    """(error de canal maximo, RMSE) entre dos imagenes RGB del mismo tamano."""
    diferencia = ImageChops.difference(a, b)
    estadistica = ImageStat.Stat(diferencia)
    peor = max(estadistica.extrema[canal][1] for canal in range(3))
    rmse = (sum(estadistica.sum2) / (a.size[0] * a.size[1] * 3)) ** 0.5
    return peor, rmse


def cuantizar_rgba(imagen, colores):
    """
    Corte por la mediana (median cut) en el espacio RGBA de 4 dimensiones.

    No se usa Image.quantize: MEDIANCUT y MAXCOVERAGE no aceptan alfa (lo aplanan y
    devuelven el borde duro que acabamos de arreglar), y FASTOCTREE, que si lo acepta,
    colapsa estos artes a ~20 colores sin importar cuantos se le pidan, lo que banda el
    degradado de la teja. Con menos de 1200 colores unicos por icono, cortar las cajas a
    mano es barato y da control real sobre el tamano de la paleta.
    """
    histograma = {}
    for pixel in imagen.get_flattened_data():
        if pixel[3] == 0:
            pixel = (0, 0, 0, 0)  # todo lo transparente colapsa a una sola entrada
        histograma[pixel] = histograma.get(pixel, 0) + 1

    cajas = [list(histograma.items())]

    def rangos(caja):
        maximos = [0] * 4
        minimos = [255] * 4
        for color, _ in caja:
            for canal in range(4):
                if color[canal] > maximos[canal]:
                    maximos[canal] = color[canal]
                if color[canal] < minimos[canal]:
                    minimos[canal] = color[canal]
        return [(maximos[c] - minimos[c]) * (PESO_ALFA_PALETA if c == 3 else 1.0) for c in range(4)]

    while len(cajas) < colores:
        # Se parte la caja que mas error aporta: ancha y con muchos pixeles detras.
        mejor_peso = -1.0
        indice = -1
        canal_corte = 0
        for i, caja in enumerate(cajas):
            if len(caja) < 2:
                continue
            rango = rangos(caja)
            canal = max(range(4), key=lambda c: rango[c])
            peso = rango[canal] * sum(n for _, n in caja) ** 0.5
            if peso > mejor_peso:
                mejor_peso, indice, canal_corte = peso, i, canal
        if indice < 0:
            break  # ya no queda nada divisible

        caja = sorted(cajas[indice], key=lambda par: par[0][canal_corte])
        total = sum(n for _, n in caja)
        acumulado = 0
        corte = 1
        for j, (_, n) in enumerate(caja):
            acumulado += n
            if acumulado >= total / 2:
                corte = max(1, min(j + 1, len(caja) - 1))
                break
        cajas[indice:indice + 1] = [caja[:corte], caja[corte:]]

    paleta = []
    mapa = {}
    for caja in cajas:
        total = sum(n for _, n in caja)
        representante = tuple(
            int(round(sum(color[canal] * n for color, n in caja) / total)) for canal in range(4)
        )
        if representante[3] == 0:
            representante = (0, 0, 0, 0)
        indice = len(paleta)
        paleta.append(representante)
        for color, _ in caja:
            mapa[color] = indice
    return paleta, mapa


def guardar_indexado(imagen, paleta, mapa, ruta_destino):
    """Escribe la imagen como PNG de paleta con alfa por entrada (chunk tRNS)."""
    indices = bytes(
        mapa[(0, 0, 0, 0) if pixel[3] == 0 else pixel] for pixel in imagen.get_flattened_data()
    )
    indexada = Image.frombytes("P", imagen.size, indices)
    plano = []
    for color in paleta:
        plano.extend(color[:3])
    plano.extend([0] * (768 - len(plano)))
    indexada.putpalette(plano)
    indexada.info["transparency"] = bytes(color[3] for color in paleta)
    indexada.save(ruta_destino, "PNG", optimize=True)


def recomprimir(imagen, ruta_destino):
    """
    Guarda como PNG de paleta con la paleta mas chica que aguanta el control de calidad.

    La verificacion se hace componiendo sobre el verde de marca y sobre blanco, que son los
    dos fondos reales donde viven estos iconos, para que el control mire tanto el bandeo
    del degradado como el dentado del borde.
    """
    referencia_verde = componer_sobre(imagen, VERDE_MARCA)
    referencia_blanco = componer_sobre(imagen, (255, 255, 255))

    elegida = None
    for colores in PALETAS_CANDIDATAS:
        paleta, mapa = cuantizar_rgba(imagen, colores)
        guardar_indexado(imagen, paleta, mapa, ruta_destino)
        prueba = Image.open(ruta_destino).convert("RGBA")
        peor_v, rmse_v = medir_diferencia(referencia_verde, componer_sobre(prueba, VERDE_MARCA))
        peor_b, rmse_b = medir_diferencia(referencia_blanco, componer_sobre(prueba, (255, 255, 255)))
        peor = max(peor_v, peor_b)
        rmse = max(rmse_v, rmse_b)
        if peor <= ERROR_MAXIMO_PIXEL and rmse <= ERROR_MEDIO_MAXIMO:
            elegida = (paleta, mapa, colores, peor, rmse)
        else:
            break  # de aqui hacia abajo solo empeora; nos quedamos con la ultima que paso

    if elegida is None:
        # Ningun tamano de paleta paso el control: se prefiere el RGBA intacto antes que
        # publicar un icono con bandeo. Pesa mas, pero no se rompe el arte.
        imagen.save(ruta_destino, "PNG", optimize=True)
        return None, None, None

    paleta, mapa, colores, peor, rmse = elegida
    guardar_indexado(imagen, paleta, mapa, ruta_destino)
    return colores, peor, rmse


def limpiar_icono(ruta, recomprimir_tambien=True):
    imagen = Image.open(ruta).convert("RGBA")
    ancho, alto = imagen.size
    pixeles = list(imagen.get_flattened_data())

    fondo = marcar_fondo_exterior(pixeles, ancho, alto)
    borrados = sum(fondo) - sum(1 for p in pixeles if p[3] <= ALFA_TRANSPARENTE)

    limpia = Image.new("RGBA", (ancho, alto))
    limpia.putdata(reconstruir_borde(pixeles, fondo, ancho, alto))

    peso_antes = os.path.getsize(ruta)
    if recomprimir_tambien:
        colores, peor, rmse = recomprimir(limpia, ruta)
    else:
        limpia.save(ruta, "PNG", optimize=True)
        colores = peor = rmse = None
    peso_despues = os.path.getsize(ruta)

    detalle = "" if colores is None else " paleta=%d err_max=%d rmse=%.2f" % (colores, peor, rmse)
    print("%-26s marco borrado: %5d px  %6d -> %5d bytes%s"
          % (os.path.basename(ruta), borrados, peso_antes, peso_despues, detalle))


def main(argv):
    recomprimir_tambien = "--sin-recomprimir" not in argv
    rutas = [a for a in argv if not a.startswith("--")]

    if not rutas:
        base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "home")
        rutas = [os.path.normpath(os.path.join(base, n)) for n in ICONOS_POR_DEFECTO]

    for ruta in rutas:
        if not os.path.isfile(ruta):
            print("No existe: %s" % ruta, file=sys.stderr)
            continue
        limpiar_icono(ruta, recomprimir_tambien)


if __name__ == "__main__":
    main(sys.argv[1:])
