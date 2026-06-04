#Requires -Version 5.1
<#
  Cloudflare Cache Rules (uzaedu.com) — statik uzun önbellek, API host bypass.
  Ortam:
    $env:CLOUDFLARE_API_TOKEN  — Zone.Cache Rules Edit + Zone.Zone Read
    $env:CLOUDFLARE_ZONE_ID    — isteğe bağlı; yoksa uzaedu.com ile aranır

  Kullanım:
    $env:CLOUDFLARE_API_TOKEN = "<token>"
    .\infra\cloudflare\apply-static-cache-rules.ps1
#>
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$dotenv = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $dotenv) {
  Get-Content $dotenv | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $k = $matches[1]; $v = $matches[2].Trim().Trim('"').Trim("'")
      if ($v) { Set-Item -Path "env:$k" -Value $v }
    }
  }
}

$token = $env:CLOUDFLARE_API_TOKEN?.Trim()
if (-not $token) {
  throw "CLOUDFLARE_API_TOKEN yok. infra/cloudflare/.env.local olusturun (.env.example) veya ortam degiskeni verin."
}

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}

function Invoke-CfApi {
  param([string]$Method, [string]$Uri, [object]$Body = $null)
  $params = @{ Method = $Method; Uri = $Uri; Headers = $headers }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 12 -Compress) }
  $r = Invoke-RestMethod @params
  if (-not $r.success) {
    throw "Cloudflare API: $($r.errors | ConvertTo-Json -Compress)"
  }
  return $r.result
}

$zoneId = $env:CLOUDFLARE_ZONE_ID?.Trim()
if (-not $zoneId) {
  $zones = Invoke-CfApi GET "https://api.cloudflare.com/client/v4/zones?name=uzaedu.com&status=active"
  if (-not $zones -or $zones.Count -lt 1) { throw "uzaedu.com zone bulunamadi." }
  $zoneId = $zones[0].id
  Write-Host "Zone: uzaedu.com ($zoneId)"
}

$phase = "http_request_cache_settings"
$entryUri = "https://api.cloudflare.com/client/v4/zones/$zoneId/rulesets/phases/$phase/entrypoint"
$entry = $null
try { $entry = Invoke-CfApi GET $entryUri } catch { }

$tag = "ogretmenpro-static-cache"
$rules = @(
  @{
    expression = '(http.host eq "api.uzaedu.com")'
    description  = "$tag: API bypass"
    action       = "set_cache_settings"
    action_parameters = @{
      cache = $false
    }
  },
  @{
    expression = '(starts_with(http.request.uri.path, "/_next/static/"))'
    description  = "$tag: Next static"
    action       = "set_cache_settings"
    action_parameters = @{
      cache = $true
      edge_ttl = @{
        mode    = "override_origin"
        default = 2592000
      }
      browser_ttl = @{ mode = "respect_origin" }
    }
  },
  @{
    expression = '(http.request.uri.path matches "^/.*\\.(css|js|mjs|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf)$")'
    description  = "$tag: static extensions"
    action       = "set_cache_settings"
    action_parameters = @{
      cache = $true
      edge_ttl = @{
        mode    = "override_origin"
        default = 2592000
      }
      browser_ttl = @{ mode = "respect_origin" }
    }
  }
)

$kept = @()
if ($entry -and $entry.rules) {
  $kept = @($entry.rules | Where-Object { $_.description -notlike "$tag:*" })
}
$merged = @($kept + $rules)
$body = @{ rules = $merged }

Write-Host "Entrypoint guncelleniyor ($($rules.Count) kural, $($kept.Count) mevcut korundu)"
Invoke-CfApi PUT $entryUri $body | Out-Null
Write-Host "Tamam. CF Cache Rules uygulandi."
