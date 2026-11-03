# X-Grid installer / updater for Windows.
# Installs the latest signed release into the current user's CEP extensions
# folder (no admin rights, no debug mode). Run it again to update.
#
#   irm https://raw.githubusercontent.com/sadekdesign/X-Grid/main/install/install.ps1 | iex
#
# Optional: $env:XGRID_ZXP = "C:\path\X-Grid.zxp" installs that file instead of downloading.

$ErrorActionPreference = "Stop"
$repo   = "sadekdesign/X-Grid"
$bundle = "com.xoutput.xgrid"
$dest   = Join-Path $env:APPDATA "Adobe\CEP\extensions\$bundle"
$tmp    = Join-Path $env:TEMP ("xgrid-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force $tmp | Out-Null

try {
    if ($env:XGRID_ZXP) {
        $zxp = $env:XGRID_ZXP
        $version = "local file"
    } else {
        Write-Host "Looking up the latest X-Grid release..."
        $rel   = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "xgrid-installer" }
        $asset = $rel.assets | Where-Object { $_.name -like "*.zxp" } | Select-Object -First 1
        if (-not $asset) { throw "The latest release has no .zxp file." }
        $zxp = Join-Path $tmp $asset.name
        Invoke-WebRequest $asset.browser_download_url -OutFile $zxp -UseBasicParsing
        $version = $rel.tag_name
    }

    # a .zxp is a signed zip: unpack it as-is so the signature stays valid
    $unpack = Join-Path $tmp "unpacked"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zxp, $unpack)
    if (-not (Test-Path (Join-Path $unpack "CSXS\manifest.xml"))) { throw "This file is not an X-Grid extension." }

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
