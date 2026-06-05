$envFile = Join-Path $PSScriptRoot "..\.env.deploy.local"
if (-not (Test-Path $envFile)) { return }
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  if ($line -match "^([^=]+)=(.*)$") {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim().Trim('"').Trim("'")
    if ($name) { Set-Item -Path "env:$name" -Value $value }
  }
}
