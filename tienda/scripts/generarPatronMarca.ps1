# Arma el mosaico de marca a partir de los íconos sueltos del arte original.
#
# El arte entregado no sirve tal cual como mosaico: trae un "smear" horizontal
# de la compresión que, al repetirse, dibuja líneas continuas de lado a lado, y
# los márgenes entre íconos son desparejos, así que se ven calles.
#
# Acá se recortan los 8 íconos por separado (descartando el smear por color) y
# se recomponen en una rejilla con separación pareja. Cada ícono se dibuja
# también en los bordes opuestos (wrap), así el mosaico calza perfecto consigo
# mismo y no se nota dónde termina un tile y empieza el siguiente.

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$ORIGEN  = "C:\Dev\Puesta en marcha CIbox\Baner\PATRON.webp"
$SALIDA  = "C:\Dev\Puesta en marcha CIbox\tienda\assets\home\patron.png"
$lado    = 560
$ICONO   = 108   # lado mayor de cada ícono dentro del mosaico

$cs = @'
using System;
using System.Collections.Generic;

public class Icono {
  public int X0, Y0, W, H;
  public byte[] Alfa;   // W*H, 0..255
}

public static class Patron {
  // Separa los iconos del arte. Se queda solo con el trazo fuerte: el smear de
  // la compresion es verde claro (min de canales alto) y aca se descarta.
  public static List<Icono> Extraer(byte[] px, int w, int h, int minCanal, int minArea) {
    bool[] trazo = new bool[w * h];
    for (int i = 0, p = 0; i < px.Length; i += 4, p++) {
      int b = px[i], g = px[i + 1], r = px[i + 2];
      int min = Math.Min(b, Math.Min(g, r));
      trazo[p] = min <= minCanal;
    }

    // Componentes conexas (8-vecinos) sobre el trazo.
    int[] etiqueta = new int[w * h];
    List<Icono> salida = new List<Icono>();
    int actual = 0;
    int[] dx = { 1, -1, 0, 0, 1, 1, -1, -1 }, dy = { 0, 0, 1, -1, 1, -1, 1, -1 };
    Queue<int> cola = new Queue<int>();

    for (int p0 = 0; p0 < w * h; p0++) {
      if (!trazo[p0] || etiqueta[p0] != 0) continue;
      actual++;
      cola.Enqueue(p0); etiqueta[p0] = actual;
      int x0 = p0 % w, y0 = p0 / w, x1 = x0, y1 = y0, area = 0;
      List<int> puntos = new List<int>();
      while (cola.Count > 0) {
        int p = cola.Dequeue(); puntos.Add(p); area++;
        int cx = p % w, cy = p / w;
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        for (int k = 0; k < 8; k++) {
          int nx = cx + dx[k], ny = cy + dy[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          int np = ny * w + nx;
          if (!trazo[np] || etiqueta[np] != 0) continue;
          etiqueta[np] = actual; cola.Enqueue(np);
        }
      }
      if (area < minArea) continue;

      // Alfa del icono: se recupera del arte completo dentro de la caja, para
      // no perder el antialiasing del borde del trazo.
      Icono ic = new Icono();
      ic.X0 = x0; ic.Y0 = y0; ic.W = x1 - x0 + 1; ic.H = y1 - y0 + 1;
      ic.Alfa = new byte[ic.W * ic.H];
      for (int y = 0; y < ic.H; y++)
        for (int x = 0; x < ic.W; x++) {
          int o = ((y0 + y) * w + (x0 + x)) * 4;
          int min = Math.Min(px[o], Math.Min(px[o + 1], px[o + 2]));
          int a = 255 - min;
          // Solo el trazo fuerte: el resto (smear) se descarta con un umbral alto.
          a = a <= 150 ? 0 : (int)((a - 150) * 255.0 / 105.0);
          ic.Alfa[y * ic.W + x] = (byte)Math.Max(0, Math.Min(255, a));
        }
      salida.Add(ic);
    }
    return salida;
  }

  // Pega un icono escalado en (cx,cy) del mosaico, repitiendolo en los bordes
  // opuestos para que el patron calce consigo mismo.
  public static void Pegar(byte[] tile, int T, Icono ic, int lado, int cx, int cy) {
    double esc = (double)lado / Math.Max(ic.W, ic.H);
    int dw = Math.Max(1, (int)(ic.W * esc)), dh = Math.Max(1, (int)(ic.H * esc));
    for (int oy = -T; oy <= T; oy += T)
      for (int ox = -T; ox <= T; ox += T) {
        int bx = cx - dw / 2 + ox, by = cy - dh / 2 + oy;
        for (int y = 0; y < dh; y++) {
          int ty = by + y; if (ty < 0 || ty >= T) continue;
          int sy = (int)(y / esc); if (sy >= ic.H) sy = ic.H - 1;
          for (int x = 0; x < dw; x++) {
            int tx = bx + x; if (tx < 0 || tx >= T) continue;
            int sx = (int)(x / esc); if (sx >= ic.W) sx = ic.W - 1;
            byte a = ic.Alfa[sy * ic.W + sx];
            if (a == 0) continue;
            int o = (ty * T + tx) * 4;
            if (a > tile[o + 3]) tile[o + 3] = a;
          }
        }
      }
  }
}
'@
Add-Type -TypeDefinition $cs -Language CSharp

# ── 1. Arte original ─────────────────────────────────────────────────────────
$frame = [System.Windows.Media.Imaging.BitmapDecoder]::Create((New-Object System.Uri $ORIGEN), 'None', 'OnLoad').Frames[0]
$conv = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap $frame, ([System.Windows.Media.PixelFormats]::Bgra32), $null, 0
$w = $conv.PixelWidth; $h = $conv.PixelHeight
$px = New-Object byte[] ($w * 4 * $h)
$conv.CopyPixels($px, $w * 4, 0)

$iconos = [Patron]::Extraer($px, $w, $h, 28, 3000)
Write-Host ("iconos detectados: {0}" -f $iconos.Count)
$iconos = $iconos | Sort-Object { - ($_.W * $_.H) } | Select-Object -First 8
foreach ($ic in $iconos) { Write-Host ("   {0}x{1}" -f $ic.W, $ic.H) }

# ── 2. Composición del mosaico ───────────────────────────────────────────────
# 4 filas separadas parejo; las filas impares van corridas media celda, para que
# el ojo no encuentre columnas alineadas.
$buf = New-Object byte[] ($lado * $lado * 4)
$paso = $lado / 4.0
$i = 0
for ($fila = 0; $fila -lt 4; $fila++) {
  $cy = [int]($paso * ($fila + 0.5))
  $corrido = if ($fila % 2 -eq 1) { $paso / 2 } else { 0 }
  for ($col = 0; $col -lt 2; $col++) {
    $cx = [int](($lado / 2.0) * ($col + 0.5) + $corrido)
    [Patron]::Pegar($buf, $lado, $iconos[$i % $iconos.Count], $ICONO, $cx, $cy)
    $i++
  }
}

# ── 3. Color de marca + guardado ─────────────────────────────────────────────
# Verde de los íconos del arte (#46B804), plano: la forma la lleva el alfa.
for ($p = 0; $p -lt $lado * $lado; $p++) {
  $o = $p * 4
  $buf[$o] = 4; $buf[$o + 1] = 184; $buf[$o + 2] = 70
}

$bmp = [System.Windows.Media.Imaging.BitmapSource]::Create(
  $lado, $lado, 96, 96, ([System.Windows.Media.PixelFormats]::Bgra32), $null, $buf, $lado * 4)
$enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
$enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
$fs = [System.IO.File]::Create($SALIDA); $enc.Save($fs); $fs.Close()

"OK -> $SALIDA  ({0}x{0}, {1} KB)" -f $lado, [math]::Round((Get-Item $SALIDA).Length / 1KB, 1)
