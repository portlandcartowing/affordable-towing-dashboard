<#
.SYNOPSIS
  Downloads every image referenced by portlandcartowing.com, compresses each
  to a mobile-friendly size + quality, saves results to a local folder.

.DESCRIPTION
  For each image:
    1. Downloads original from https://portlandcartowing.com/
    2. Resizes so the longest edge is at most -MaxWidth (default 1600px)
    3. Re-encodes JPEG at -Quality (default 70)
    4. Saves to ./compressed/images/ or ./compressed/assets/img/gallery/
       mirroring the server path so you can drop the folder into File Manager.
    5. Reports before/after bytes + % savings.

  Uses .NET System.Drawing — works on vanilla Windows PowerShell 5.1+.
  No external installs, no internet-upload tools.

.PARAMETER OutDir
  Local directory where compressed images will be written. Default: ./compressed

.PARAMETER Quality
  JPEG quality 1-100. Default 70 (visually indistinguishable at typical
  browser render sizes, cuts file size 5-10x).

.PARAMETER MaxWidth
  Longest-edge cap in pixels. Default 1600 (good for retina desktop + mobile).

.EXAMPLE
  ./compress-images.ps1

.EXAMPLE
  ./compress-images.ps1 -Quality 60 -MaxWidth 1400
#>

[CmdletBinding()]
param(
  [string]$OutDir   = "./compressed",
  [int]   $Quality  = 70,
  [int]   $MaxWidth = 1600
)

Add-Type -AssemblyName System.Drawing

# --- List of every image portlandcartowing.com serves (from site crawl) ---
$images = @(
  "images/tow-truck-hero.jpg",
  "images/logo.png",
  "assets/img/gallery/flatbed-tow-truck-white-sedan-01.jpg",
  "assets/img/gallery/flatbed-towing-white-coupe-05.jpg",
  "assets/img/gallery/local-flatbed-tow-dark-sedan-02.jpg",
  "assets/img/gallery/night-flatbed-towing-service-18.jpg",
  "assets/img/gallery/night-roadside-flatbed-view-28.jpg",
  "assets/img/gallery/night-roadside-tow-lightbar-19.jpg",
  "assets/img/gallery/night-sedan-flatbed-transport-22.jpg",
  "assets/img/gallery/night-sports-car-flatbed-17.jpg",
  "assets/img/gallery/night-suv-rollback-tow-21.jpg",
  "assets/img/gallery/night-towing-white-car-16.jpg",
  "assets/img/gallery/pickup-truck-dawn-tow-20.jpg",
  "assets/img/gallery/police-car-flatbed-rear-view-34.jpg"
)

# JPEG encoder setup
$jpegEncoder  = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$qualityParam  = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $Quality
$encoderParams.Param[0] = $qualityParam

# Ensure output dir exists
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$totalBefore = 0
$totalAfter  = 0
$failures    = @()

Write-Host ""
Write-Host "Compressing images from portlandcartowing.com ..." -ForegroundColor Cyan
Write-Host "  Output folder: $OutDir"
Write-Host "  JPEG quality:  $Quality"
Write-Host "  Max edge:      $MaxWidth px"
Write-Host ""

foreach ($relPath in $images) {
  $url        = "https://portlandcartowing.com/$relPath"
  $localPath  = Join-Path $OutDir $relPath
  $localDir   = Split-Path $localPath
  if (-not (Test-Path $localDir)) { New-Item -ItemType Directory -Path $localDir -Force | Out-Null }

  $tempDownload = [System.IO.Path]::GetTempFileName()
  try {
    # 1. Download
    Invoke-WebRequest -Uri $url -OutFile $tempDownload -UseBasicParsing -ErrorAction Stop
    $bytesBefore = (Get-Item $tempDownload).Length
    $totalBefore += $bytesBefore

    # 2. Load + process
    $img = [System.Drawing.Image]::FromFile($tempDownload)

    # Resize if too wide
    $newWidth  = $img.Width
    $newHeight = $img.Height
    if ($img.Width -gt $MaxWidth -or $img.Height -gt $MaxWidth) {
      $ratio = [Math]::Min($MaxWidth / $img.Width, $MaxWidth / $img.Height)
      $newWidth  = [int]($img.Width  * $ratio)
      $newHeight = [int]($img.Height * $ratio)
    }

    $bmp = New-Object System.Drawing.Bitmap $newWidth, $newHeight
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $newWidth, $newHeight)

    # 3. Save — JPEGs re-encode at quality; PNGs (logo) save as-is
    $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
    if ($ext -eq '.png') {
      $bmp.Save($localPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
      $bmp.Save($localPath, $jpegEncoder, $encoderParams)
    }

    $bytesAfter = (Get-Item $localPath).Length
    $totalAfter += $bytesAfter

    $savedPct = [Math]::Round((1 - $bytesAfter / $bytesBefore) * 100, 1)
    $beforeKb = [Math]::Round($bytesBefore / 1KB, 1)
    $afterKb  = [Math]::Round($bytesAfter  / 1KB, 1)
    $line = ("{0,-52}  {1,8:N1} KB -> {2,6:N1} KB  (-{3,4}%)" -f $relPath, $beforeKb, $afterKb, $savedPct)

    if ($savedPct -gt 0) {
      Write-Host $line -ForegroundColor Green
    } else {
      Write-Host $line -ForegroundColor Yellow
    }

    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
  }
  catch {
    Write-Host ("FAILED  {0} : {1}" -f $relPath, $_.Exception.Message) -ForegroundColor Red
    $failures += $relPath
  }
  finally {
    if (Test-Path $tempDownload) { Remove-Item $tempDownload -Force }
  }
}

# --- Summary ---
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
$beforeMb = [Math]::Round($totalBefore / 1MB, 2)
$afterMb  = [Math]::Round($totalAfter  / 1MB, 2)
$savedMb  = $beforeMb - $afterMb
$savedPct = if ($totalBefore -gt 0) { [Math]::Round((1 - $totalAfter / $totalBefore) * 100, 1) } else { 0 }
Write-Host ("Before:   {0} MB"              -f $beforeMb)
Write-Host ("After:    {0} MB"              -f $afterMb)
Write-Host ("Saved:    {0} MB ({1}%)"       -f $savedMb, $savedPct) -ForegroundColor Green
Write-Host ""
Write-Host "Compressed files are in: $(Resolve-Path $OutDir)"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Open Bluehost File Manager -> public_html"
Write-Host "  2. Upload the 'images/' folder from $OutDir to replace public_html/images/"
Write-Host "  3. Upload the 'assets/img/gallery/' folder to replace public_html/assets/img/gallery/"
Write-Host "     (or drag-drop each file individually — Bluehost will overwrite existing)"
Write-Host "  4. Hard-refresh portlandcartowing.com on your phone to verify smaller images"

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "WARNING: $($failures.Count) file(s) failed to process:" -ForegroundColor Yellow
  $failures | ForEach-Object { Write-Host "  $_" }
}
