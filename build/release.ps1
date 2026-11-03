# Maintainers: build and sign X-Grid.zxp from this repo.
#
#   $env:XGRID_SIGNCMD   = "...\ZXPSignCmd.exe"   (Adobe-CEP/CEP-Resources, 4.1.103+)
#   $env:XGRID_CERT      = "...\xgrid-cert.p12"
#   $env:XGRID_CERT_PASS = "..."                   (never commit the cert or password)
#   .\build\release.ps1                            → dist\X-Grid.zxp
#   .\build\release.ps1 -Publish                   → also creates the GitHub release v<version>
param([switch]$Publish)
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot
foreach ($v in "XGRID_SIGNCMD", "XGRID_CERT", "XGRID_CERT_PASS") {
    if (-not [Environment]::GetEnvironmentVariable($v)) { throw "Set `$env:$v first." }
}
$version = ([xml](Get-Content "$root\CSXS\manifest.xml")).ExtensionManifest.ExtensionBundleVersion

# stage only what the panel needs
$stage = Join-Path $env:TEMP "xgrid-stage\com.xoutput.xgrid"
Remove-Item (Split-Path $stage) -Recurse -Force -ErrorAction SilentlyContinue
foreach ($p in "CSXS", "css", "fonts", "img", "js", "jsx", "index.html") {
    Copy-Item (Join-Path $root $p) (Join-Path $stage $p) -Recurse -Force -ErrorAction Stop
}
New-Item -ItemType Directory -Force "$root\dist" | Out-Null
$zxp = "$root\dist\X-Grid.zxp"
Remove-Item $zxp -ErrorAction SilentlyContinue

& $env:XGRID_SIGNCMD -sign $stage $zxp $env:XGRID_CERT $env:XGRID_CERT_PASS
if ($LASTEXITCODE) { throw "Signing failed." }
& $env:XGRID_SIGNCMD -verify $zxp
if ($LASTEXITCODE) { throw "Signature check failed." }
Write-Host "Built $zxp (v$version)"

if ($Publish) {
    gh release create "v$version" $zxp --title "X-Grid $version" --notes "Install or update: see README."
}
