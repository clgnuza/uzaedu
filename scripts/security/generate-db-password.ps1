# Guvenli rastgele DB sifresi (harf+rakam, .env icin guvenli karakterler)
param(
  [int]$Length = 48,
  [switch]$SetLocalEnv
)
$ErrorActionPreference = "Stop"
$chars = [char[]]([char]'A'..[char]'Z' + [char]'a'..[char]'z' + [char]'0'..[char]'9')
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] $Length
$rng.GetBytes($bytes)
$sb = [System.Text.StringBuilder]::new($Length)
foreach ($b in $bytes) {
  [void]$sb.Append($chars[$b % $chars.Length])
}
$pw = $sb.ToString()
Write-Host $pw
if ($SetLocalEnv) {
  $root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  $envFile = Join-Path $root "backend\.env"
  if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Warning "Yok: $envFile — SetLocalEnv atlandi."
    exit 0
  }
  $lines = Get-Content -LiteralPath $envFile
  $done = $false
  $out = foreach ($line in $lines) {
    if ($line -match '^\s*DB_PASSWORD=') {
      "DB_PASSWORD=$pw"
      $done = $true
    } else { $line }
  }
  if (-not $done) { $out = @($out) + "DB_PASSWORD=$pw" }
  Set-Content -LiteralPath $envFile -Value $out -Encoding utf8
  Write-Host "Guncellendi: $envFile"
}