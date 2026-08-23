# Arma el mosaico de marca (tienda/assets/home/patron.png) a partir del arte
# original Baner/PATRON.webp.
#
# POR QUÉ EXISTE ESTE SCRIPT (y por qué reemplaza al .ps1)
# --------------------------------------------------------
# El generador anterior (generarPatronMarca.ps1) leía el WebP con el decodificador
# de WPF/Windows, y ese decodificador NO entrega el canal alfa: devuelve solo RGB
# y descarta el plano de transparencia. Sin alfa, el script lo reconstruía
# adivinando por brillo (255 - min(R,G,B)), y como el interior transparente de los
# íconos igual trae color, terminaba pintando ~624.000 píxeles que en el arte son
# invisibles. Resultado: los 8 íconos, que en el master son contornos huecos,
# salían rellenos de manchones verdes y rayas horizontales.
#
# Ajustar el umbral de brillo dentro del .ps1 no arregla nada (se probó: da ocho
# cuadrados verdes macizos). La reconstrucción por brillo es un callejón sin
# salida; había que dejar de usar ese decodificador.
#
# Pillow sí lee el alfa del WebP correctamente, así que el mosaico se genera acá.
# La composición (cantidad de íconos, escalonado de las filas y tamaño aparente)
# es exactamente la misma que producía el .ps1: el fondo no cambia de diseño,
# solo deja de estar sucio.
#
# Uso:  python tienda/scripts/generarPatronMarca.py

from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "Baner" / "PATRON.webp"
SALIDA = RAIZ / "tienda" / "assets" / "home" / "patron.png"

LADO = 560          # lado del tile que consume BrandBackdrop
ICONO = 108         # lado mayor de cada ícono dentro del mosaico
FILAS = 4           # filas del mosaico
COLUMNAS = 2        # íconos por fila

# Verde plano del patrón. La forma la lleva el alfa, así que el RGB es uniforme.
# Se usa el primary de la paleta oficial (theme.js / brand.js). El tile viejo
# traía #46B804, un verde que no está en la paleta y que venía arrastrado del
# arte; a la opacidad con la que se dibuja el fondo la diferencia no se ve, pero
# no tiene sentido mantener un color fuera de marca.
VERDE = "#4E9B27"


def _bandas(ocupado, hueco_min):
    """Tramos contiguos de True, uniendo los que estén separados por menos de
    `hueco_min` vacíos. Sirve para separar los íconos por proyección: entre ícono
    e ícono el arte tiene columnas/filas totalmente transparentes."""
    idx = np.flatnonzero(ocupado)
    if idx.size == 0:
        return []
    cortes = np.flatnonzero(np.diff(idx) > hueco_min)
    inicios = np.r_[idx[0], idx[cortes + 1]]
    finales = np.r_[idx[cortes], idx[-1]]
    return list(zip(inicios.tolist(), finales.tolist()))


def detectar_iconos(alfa):
    """Devuelve las cajas (x0, y0, w, h) de cada ícono del arte, detectadas por
    bounding box del contenido no transparente. No hay posiciones hardcodeadas:
    si el diseñador reordena el master, esto lo sigue encontrando."""
    mascara = alfa > 0
    # El hueco entre íconos es de ~180px en un arte de 2000px; 2% es holgado para
    # no partir un ícono por sus propios espacios internos y estricto para no
    # pegar dos íconos vecinos.
    hueco = max(4, int(round(max(alfa.shape) * 0.02)))

    cajas = []
    for y0, y1 in _bandas(mascara.any(axis=1), hueco):
        franja = mascara[y0:y1 + 1]
        for x0, x1 in _bandas(franja.any(axis=0), hueco):
            celda = franja[:, x0:x1 + 1]
            ys = np.flatnonzero(celda.any(axis=1))
            cajas.append((x0, y0 + int(ys[0]), x1 - x0 + 1, int(ys[-1] - ys[0] + 1)))
    return cajas


def pegar_con_wrap(tile, icono, cx, cy):
    """Pega el ícono centrado en (cx, cy) y también en los bordes opuestos, así
    lo que sale por la derecha entra por la izquierda y lo que sale por abajo
    entra por arriba: el mosaico calza consigo mismo sin costuras.

    Se compone por máximo de alfa (no por alpha-blend) porque el tile es de un
    solo color plano: sumar opacidades ahí solo generaría bordes más oscuros."""
    lado = tile.shape[0]
    alto, ancho = icono.shape
    for oy in (-lado, 0, lado):
        for ox in (-lado, 0, lado):
            bx, by = cx - ancho // 2 + ox, cy - alto // 2 + oy
            dx0, dy0 = max(0, bx), max(0, by)
            dx1, dy1 = min(lado, bx + ancho), min(lado, by + alto)
            if dx0 >= dx1 or dy0 >= dy1:
                continue
            recorte = icono[dy0 - by:dy1 - by, dx0 - bx:dx1 - bx]
            destino = tile[dy0:dy1, dx0:dx1]
            np.maximum(destino, recorte, out=destino)


def main():
    arte = Image.open(ORIGEN).convert("RGBA")
    alfa = np.array(arte)[:, :, 3]
    print(f"arte: {ORIGEN.name} {arte.size[0]}x{arte.size[1]} RGBA")

    cajas = detectar_iconos(alfa)
    esperados = FILAS * COLUMNAS
    if len(cajas) != esperados:
        raise SystemExit(
            f"se detectaron {len(cajas)} íconos y el mosaico necesita {esperados}. "
            "Revisar el arte original antes de regenerar."
        )

    # Mismo orden que usaba el .ps1: de mayor a menor caja. Así cada ícono cae en
    # la misma celda del mosaico que ocupaba antes y el fondo no se reordena.
    cajas.sort(key=lambda c: -(c[2] * c[3]))

    canal = Image.fromarray(alfa, mode="L")
    iconos = []
    for x0, y0, w, h in cajas:
        escala = ICONO / max(w, h)
        destino = (max(1, int(w * escala)), max(1, int(h * escala)))
        # LANCZOS y no NEAREST: el trazo del master es finito y viene con
        # antialias; con NEAREST el contorno se rompe en escalones.
        recorte = canal.crop((x0, y0, x0 + w, y0 + h)).resize(destino, Image.LANCZOS)
        iconos.append(np.array(recorte))
        print(f"  ícono {w}x{h} -> {destino[0]}x{destino[1]}")

    # Composición: FILAS filas parejas; las impares van corridas media celda para
    # que el ojo no encuentre columnas alineadas y el tile no se lea como rejilla.
    tile = np.zeros((LADO, LADO), dtype=np.uint8)
    paso = LADO / FILAS
    i = 0
    for fila in range(FILAS):
        cy = int(paso * (fila + 0.5))
        corrido = paso / 2 if fila % 2 else 0
        for col in range(COLUMNAS):
            cx = int((LADO / COLUMNAS) * (col + 0.5) + corrido)
            pegar_con_wrap(tile, iconos[i % len(iconos)], cx, cy)
            print(f"  celda fila {fila} col {col} -> centro ({cx}, {cy})")
            i += 1

    rgb = tuple(int(VERDE[k:k + 2], 16) for k in (1, 3, 5))
    salida = np.zeros((LADO, LADO, 4), dtype=np.uint8)
    salida[:, :, 0], salida[:, :, 1], salida[:, :, 2] = rgb
    salida[:, :, 3] = tile

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(salida, mode="RGBA").save(SALIDA, optimize=True)

    opacos = float((tile == 255).mean() * 100)
    semi = float(((tile > 0) & (tile < 255)).mean() * 100)
    kb = SALIDA.stat().st_size / 1024
    print(f"OK -> {SALIDA}")
    print(f"   {LADO}x{LADO} RGBA, {kb:.1f} KB, verde {VERDE}")
    print(f"   alfa: {opacos:.2f}% opaco, {semi:.2f}% semitransparente, "
          f"{100 - opacos - semi:.2f}% vacío")


if __name__ == "__main__":
    main()
