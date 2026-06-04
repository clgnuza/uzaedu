#Requires -Version 5.1
<#
  uzaedu.conf → Hetzner nginx + reload
  Ortam: DEPLOY_SSH_HOST (yoksa api.uzaedu.com A), DEPLOY_SSH_KEY (varsayılan ~/.ssh/id_rsa_uzaedu)
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$conf = Join-Path $root "nginx\uzaedu.conf"
if (-not (Test-Path $conf)) { throw "Dosya yok: $conf" }

$hostAddr = $env:DEPLOY_SSH_HOST
if (-not $hostAddr) {
  $ans = Resolve-DnsName -Name "api.uzaedu.com" -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | Select-Object -First 1
  $hostAddr = $ans.IPAddress
}
$user = if ($env:DEPLOY_SSH_USER) { $env:DEPLOY_SSH_USER } else { "root" }
$key = if ($env:DEPLOY_SSH_KEY) { $env:DEPLOY_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_rsa_uzaedu" }
$target = "${user}@${hostAddr}"

& scp -i $key -o BatchMode=yes $conf "${target}:/etc/nginx/sites-available/uzaedu"
& ssh -i $key -o BatchMode=yes $target "nginx -t && systemctl reload nginx"
if ($LASTEXITCODE -ne 0) { throw "nginx reload basarisiz" }
Write-Host "nginx OK: gzip_comp_level ve static location'lar guncellendi."
