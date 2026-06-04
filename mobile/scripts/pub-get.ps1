param(
  [switch]$UsePubDev,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$FlutterArgs
)
Set-Location (Join-Path $PSScriptRoot '..')
if (-not $UsePubDev) {
  $env:PUB_HOSTED_URL = 'https://pub.flutter-io.cn'
  Write-Host "PUB_HOSTED_URL=$env:PUB_HOSTED_URL"
}
flutter pub get @FlutterArgs
$code = $LASTEXITCODE
if ($code -ne 0 -and -not $UsePubDev) {
  Write-Host 'Mirror failed; retrying pub.dev...' -ForegroundColor Yellow
  Remove-Item Env:PUB_HOSTED_URL -ErrorAction SilentlyContinue
  flutter pub get @FlutterArgs
  $code = $LASTEXITCODE
}
exit $code
