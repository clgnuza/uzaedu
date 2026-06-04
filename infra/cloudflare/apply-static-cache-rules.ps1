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

$token = $env:CLOUDFLARE_API_TOKEN?.Trim()
if (-not $token) { throw "CLOUDFLARE_API_TOKEN tanimli degil." }

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
$existing = Invoke-CfApi GET "https://api.cloudflare.com/client/v4/zones/$zoneId/rulesets?phase=$phase"
$rulesetName = "Uzaedu static cache (repo)"
$found = $existing | Where-Object { $_.name -eq $rulesetName } | Select-Object -First 1

$rules = @(
  @{
    expression = '(http.host eq "api.uzaedu.com")'
    description  = "API — edge cache kapali"
    action       = "set_cache_settings"
    action_parameters = @{
      cache = $false
    }
  },
  @{
    expression = '(starts_with(http.request.uri.path, "/_next/static/"))'
    description  = "Next build static"
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
    description  = "Statik dosya uzantilari"
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

$body = @{
  name        = $rulesetName
  description = "ogretmenpro infra/cloudflare — statik onbellek"
  kind        = "zone"
  phase       = $phase
  rules       = $rules
}

if ($found) {
  Write-Host "Guncelleniyor: $($found.id)"
  Invoke-CfApi PUT "https://api.cloudflare.com/client/v4/zones/$zoneId/rulesets/$($found.id)" $body | Out-Null
} else {
  Write-Host "Olusturuluyor: $rulesetName"
  Invoke-CfApi POST "https://api.cloudflare.com/client/v4/zones/$zoneId/rulesets" $body | Out-Null
}

Write-Host "Tamam. CF Cache Rules uygulandi."
