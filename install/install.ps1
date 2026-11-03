# X-Grid installer / updater for Windows.
# Installs the latest signed release into the current user's CEP extensions
# folder (no admin rights, no debug mode). Run it again to update.
#
#   irm https://x-output.com/lab/x-grid/install.ps1 | iex
#
# Optional: $env:XGRID_ZXP = "C:\path\X-Grid.zxp" installs that file instead of downloading.
#           $env:XGRID_BASE = "http://localhost:3000/lab/x-grid" downloads from another host (testing).

$ErrorActionPreference = "Stop"
$base   = if ($env:XGRID_BASE) { $env:XGRID_BASE.TrimEnd("/") } else { "https://x-output.com/lab/x-grid" }
$bundle = "com.xoutput.xgrid"
$dest   = Join-Path $env:APPDATA "Adobe\CEP\extensions\$bundle"
$tmp    = Join-Path $env:TEMP ("xgrid-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force $tmp | Out-Null

try {
    if ($env:XGRID_ZXP) {
        $zxp = $env:XGRID_ZXP
    } else {
        Write-Host "Downloading the latest X-Grid..."
        $zxp = Join-Path $tmp "X-Grid.zxp"
        Invoke-WebRequest "$base/X-Grid.zxp" -OutFile $zxp -UseBasicParsing
    }

    # a .zxp is a signed zip: unpack it as-is so the signature stays valid
    $unpack = Join-Path $tmp "unpacked"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zxp, $unpack)
    $manifest = Join-Path $unpack "CSXS\manifest.xml"
    if (-not (Test-Path $manifest)) { throw "This file is not an X-Grid extension." }
    $version = ([xml](Get-Content $manifest)).ExtensionManifest.ExtensionBundleVersion

    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Move-Item $unpack $dest

    $running = Get-Process -Name "Illustrator" -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "X-Grid $version installed to $dest" -ForegroundColor Green
    if ($running) { Write-Host "Restart Illustrator to load it." -ForegroundColor Yellow }
    Write-Host "Open it from Window > Extensions > X-Grid."
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
