# Deja la franja del newsletter como PURO DEGRADADO, sin el ícono incrustado.
#
# El arte entregado (BANNER NEWS.webp) trae el ícono de noticias dibujado a la
# izquierda. Como el bloque del newsletter tiene casi la misma proporción que el
# arte, ese ícono se ve entero y choca con el ícono del layout y con el título.
#
# Acá se reconstruye el degradado columna por columna, ignorando los píxeles
# blancos del ícono: para cada x se toma la mediana de la columna descartando lo
# claro. Queda una franja limpia que se puede estirar a cualquier alto sin
# deformar nada, y el ícono lo dibuja el layout (nítido y bien puesto).

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$ORIGEN = "C:\Dev\Puesta en marcha CIbox\Baner\BANNER NEWS.webp"
$SALIDA = "C:\Dev\Puesta en marcha CIbox\tienda\assets\home\banner-news.png"

$frame = [System.Windows.Media.Imaging.BitmapDecoder]::Create((New-Object System.Uri $ORIGEN), 'None', 'OnLoad').Frames[0]
$conv = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap $frame, ([System.Windows.Media.PixelFormats]::Bgra32), $null, 0
$anchoSrc = $conv.PixelWidth; $altoSrc = $conv.PixelHeight
$px = New-Object byte[] ($anchoSrc * 4 * $altoSrc)
$conv.CopyPixels($px, $anchoSrc * 4, 0)

$cs = @'
using System;
using System.Collections.Generic;

public static class Franja {
  // Color del degradado en cada columna: mediana de la columna descartando lo
  // muy claro (el ícono es blanco) y lo muy oscuro (el borde antialias).
  public static byte[] Degradado(byte[] px, int w, int h, int altoSalida) {
    byte[] outp = new byte[w * altoSalida * 4];
    for (int x = 0; x < w; x++) {
      List<int> cb = new List<int>(), cg = new List<int>(), cr = new List<int>();
      for (int y = 0; y < h; y++) {
        int o = (y * w + x) * 4;
        int b = px[o], g = px[o + 1], r = px[o + 2];
        int min = Math.Min(b, Math.Min(g, r)), max = Math.Max(b, Math.Max(g, r));
        if (min > 200) continue;      // blanco del ícono
        if (max < 40) continue;       // sombra del borde
        cb.Add(b); cg.Add(g); cr.Add(r);
      }
      byte fb, fg, fr;
      if (cb.Count == 0) {            // columna tapada entera: se copia el centro
        int o = ((h / 2) * w + x) * 4;
        fb = px[o]; fg = px[o + 1]; fr = px[o + 2];
      } else {
        cb.Sort(); cg.Sort(); cr.Sort();
        fb = (byte)cb[cb.Count / 2]; fg = (byte)cg[cg.Count / 2]; fr = (byte)cr[cr.Count / 2];
      }
      for (int y = 0; y < altoSalida; y++) {
        int o = (y * w + x) * 4;
        outp[o] = fb; outp[o + 1] = fg; outp[o + 2] = fr; outp[o + 3] = 255;
      }
    }
    return outp;
  }
}
'@
Add-Type -TypeDefinition $cs -Language CSharp

$altoSalida = 24     # basta con una franja baja: el degradado es horizontal
$out = [Franja]::Degradado($px, $anchoSrc, $altoSrc, $altoSalida)

$bmp = [System.Windows.Media.Imaging.BitmapSource]::Create(
  $anchoSrc, $altoSalida, 96, 96, ([System.Windows.Media.PixelFormats]::Bgra32), $null, $out, $anchoSrc * 4)
$enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
$enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
$fs = [System.IO.File]::Create($SALIDA); $enc.Save($fs); $fs.Close()

# Muestra de los extremos, para confirmar que quedó el degradado del diseño.
$i0 = 0; $i1 = ($anchoSrc - 1) * 4
"izquierda #{0:X2}{1:X2}{2:X2}   derecha #{3:X2}{4:X2}{5:X2}" -f $out[$i0+2],$out[$i0+1],$out[$i0],$out[$i1+2],$out[$i1+1],$out[$i1]
"OK -> $SALIDA  ({0}x{1}, {2} KB)" -f $anchoSrc, $altoSalida, [math]::Round((Get-Item $SALIDA).Length / 1KB, 1)
