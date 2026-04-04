# DNS yayinlanana kadar uzaedu domainlerini sunucu IP'sine yonlendirir.
# PowerShell: Yonetici olarak calistir.

$ip = "178.104.124.176"
$hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
$marker = "# uzaedu local DNS"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Error "PowerShell'i Yonetici olarak acip tekrar calistirin."
  exit 1
}

$text = Get-Content -LiteralPath $hostsPath -Raw
if ($text -match [regex]::Escape($marker)) {
  Write-Host "hosts icinde uzaedu blogu zaten var."
  exit 0
}

$block = @"

$marker
${ip}`tadmin.uzaedu.com
${ip}`tapi.uzaedu.com
${ip}`tuzaedu.com
${ip}`twww.uzaedu.com
"@
Add-Content -LiteralPath $hostsPath -Value $block -Encoding ascii
Write-Host "Tamam: https://admin.uzaedu.com"
