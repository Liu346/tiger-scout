$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 55000
while ($port -lt 55100) {
  $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
  try {
    $probe.Start()
    $probe.Stop()
    break
  }
  catch {
    $probe.Stop()
    $port++
  }
}
if ($port -ge 55100) {
  throw 'Tiger Scout could not find an available local port between 55000 and 55099.'
}
$prefix = "http://localhost:$port/"
$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
}
catch {
  Write-Host "Tiger Scout could not start because port $port is already in use." -ForegroundColor Red
  Write-Host 'Close the application using that port, or change $port near the top of this file.'
  Read-Host 'Press Enter to close'
  exit 1
}

Write-Host ''
Set-Content -LiteralPath (Join-Path $root 'work\current-port.txt') -Value $port
Write-Host '  Tiger Scout is running' -ForegroundColor DarkYellow
Write-Host "  $prefix" -ForegroundColor Cyan
Write-Host '  Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

Start-Process $prefix

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg' = 'image/svg+xml'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $root $relative))

    if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $path -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }

    $extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
    $contentType = $mimeTypes[$extension]
    if (-not $contentType) { $contentType = 'application/octet-stream' }
    $bytes = [IO.File]::ReadAllBytes($path)
    $context.Response.ContentType = $contentType
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
