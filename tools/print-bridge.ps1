# Puente de impresion termica RPP02N (58mm) para Bodega 12.
# Recibe la boleta como JSON de "ops" ESC/POS desde el panel (HTTP local) y la
# escribe en el puerto serie Bluetooth de la impresora. Sin drivers, sin npm.
#
# Uso:   powershell -ExecutionPolicy Bypass -File tools\print-bridge.ps1
#        (opcional)  -Com COM4  -Port 9110  -Baud 9600
#
# El panel apunta por defecto a http://127.0.0.1:9110  (localStorage b12_print_bridge para cambiarlo).
param([string]$Com = 'COM4', [int]$Port = 9110, [int]$Baud = 9600)

$ErrorActionPreference = 'Stop'
$W = 32  # caracteres por linea (fuente A a 58mm)

# Respaldo: quita acentos por si algo llega sin transliterar (el panel ya lo hace).
function To-Ascii([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return '' }
  # Normaliza (separa la tilde de la letra), descarta las marcas y todo lo no-ASCII.
  $norm = $s.Normalize([System.Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $norm.ToCharArray()) {
    $cat = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($cat -eq [System.Globalization.UnicodeCategory]::NonSpacingMark) { continue }
    if ([int]$ch -lt 128) { [void]$sb.Append($ch) } else { [void]$sb.Append(' ') }
  }
  return $sb.ToString()
}

# Convierte la lista de ops en bytes ESC/POS.
function Build-Bytes($ops) {
  $b = [System.Collections.Generic.List[byte]]::new()
  $emit = { param($s) $b.AddRange([System.Text.Encoding]::ASCII.GetBytes((To-Ascii ([string]$s)))) }
  $b.AddRange([byte[]]@(27,64))   # ESC @  inicializa
  foreach ($op in $ops) {
    switch ([string]$op.a) {
      'init'  { $b.AddRange([byte[]]@(27,64)) }
      'align' { $m=@{left=0;center=1;right=2}; $v=$m[[string]$op.v]; if($null -eq $v){$v=0}; $b.AddRange([byte[]]@(27,97,[byte]$v)) }
      'size'  { $m=@{normal=0;dh=1;dw=16;dhw=17}; $v=$m[[string]$op.v]; if($null -eq $v){$v=0}; $b.AddRange([byte[]]@(29,33,[byte]$v)) }
      'bold'  { $b.AddRange([byte[]]@(27,69,[byte]([int][bool]$op.v))) }
      'text'  { & $emit $op.v; $b.Add(10) }
      'line'  { & $emit ('-' * $W); $b.Add(10) }
      'row'   {
        $l = To-Ascii ([string]$op.l); $r = To-Ascii ([string]$op.r)
        if (($l.Length + $r.Length) -ge $W) { $l = $l.Substring(0, [Math]::Max(0, $W - $r.Length - 1)) }
        $sp = [Math]::Max(1, $W - $l.Length - $r.Length)
        & $emit ($l + (' ' * $sp) + $r); $b.Add(10)
      }
      'feed'  { $n=[int]$op.v; if($n -lt 1){$n=1}; for($i=0;$i -lt $n;$i++){$b.Add(10)} }
      'cut'   { $b.AddRange([byte[]]@(10,10,10,29,86,0)) }   # feed + corte (si tiene)
      'qr'    {
        $d = [System.Text.Encoding]::ASCII.GetBytes([string]$op.v)
        $sz = 6; if ($op.size) { $sz = [int]$op.size }
        $b.AddRange([byte[]]@(29,40,107,3,0,49,67,[byte]$sz))   # tamano de modulo
        $b.AddRange([byte[]]@(29,40,107,3,0,49,69,48))          # correccion L
        $len = $d.Length + 3
        $b.AddRange([byte[]]@(29,40,107,[byte]($len -band 255),[byte](($len -shr 8) -band 255),49,80,48))
        $b.AddRange($d)                                         # almacena
        $b.AddRange([byte[]]@(29,40,107,3,0,49,81,48))          # imprime
      }
    }
  }
  return ,$b.ToArray()
}

function Send-ToPrinter([byte[]]$bytes) {
  $sp = New-Object System.IO.Ports.SerialPort($Com, $Baud)
  $sp.WriteTimeout = 6000
  $sp.Open()
  try { $sp.Write($bytes, 0, $bytes.Length); Start-Sleep -Milliseconds 500 }
  finally { $sp.Close() }
}

# CORS + Private Network Access (Chrome exige Allow-Private-Network para que una
# pagina https (vercel) pueda llamar a un servicio en 127.0.0.1).
$CORS = "Access-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: POST, GET, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nAccess-Control-Allow-Private-Network: true`r`n"
function Respond($stream, $status, $obj) {
  $json = if ($obj -is [string]) { $obj } else { ($obj | ConvertTo-Json -Compress) }
  $body = [System.Text.Encoding]::UTF8.GetBytes($json)
  $head = "HTTP/1.1 $status`r`n$CORS" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Puente RPP02N escuchando en http://127.0.0.1:$Port  ->  $Com @ $Baud baud"
Write-Host "Deja esta ventana abierta. Ctrl+C para detener."

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $ns = $client.GetStream(); $ns.ReadTimeout = 5000
    $buf = New-Object byte[] 16384
    $ms  = New-Object System.IO.MemoryStream
    $headerText = $null; $contentLength = 0; $bodyStart = 0
    do {
      $n = $ns.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      $ms.Write($buf, 0, $n)
      $bytes = $ms.ToArray()
      if ($null -eq $headerText) {
        $s = [System.Text.Encoding]::ASCII.GetString($bytes)
        $idx = $s.IndexOf("`r`n`r`n")
        if ($idx -ge 0) {
          $headerText = $s.Substring(0, $idx); $bodyStart = $idx + 4
          $mm = [regex]::Match($headerText, '(?im)^Content-Length:\s*(\d+)')
          if ($mm.Success) { $contentLength = [int]$mm.Groups[1].Value }
        }
      }
      if ($null -ne $headerText -and ($ms.Length - $bodyStart) -ge $contentLength) { break }
    } while ($true)

    $line = ($headerText -split "`r`n")[0]
    $method = ($line -split ' ')[0]
    $path   = ($line -split ' ')[1]

    if ($method -eq 'OPTIONS') { Respond $ns '204 No Content' '' }
    elseif ($method -eq 'GET' -and $path -like '/ping*') { Respond $ns '200 OK' @{ ok = $true; com = $Com } }
    elseif ($method -eq 'POST' -and $path -like '/print*') {
      $bodyBytes = $ms.ToArray()
      $bodyStr = [System.Text.Encoding]::UTF8.GetString($bodyBytes, $bodyStart, [Math]::Min($contentLength, $bodyBytes.Length - $bodyStart))
      $data = $bodyStr | ConvertFrom-Json
      $out = Build-Bytes $data.ops
      Send-ToPrinter $out
      Write-Host ("[{0}] impreso: {1} bytes" -f (Get-Date -Format 'HH:mm:ss'), $out.Length)
      Respond $ns '200 OK' @{ ok = $true; bytes = $out.Length }
    }
    else { Respond $ns '404 Not Found' @{ ok = $false } }
  }
  catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    try { if ($ns) { Respond $ns '500 Internal Server Error' @{ ok = $false; error = $_.Exception.Message } } } catch {}
  }
  finally { if ($client) { $client.Close() } }
}
