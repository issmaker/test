param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$space = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 5, 13, 18))
$edge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 45, 72, 84), 6)
$orangeGlow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, 255, 79, 20), 20)
$orange = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 105, 31), 8)
$light = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 219, 163), 4)
$black = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::Black)

$graphics.FillEllipse($space, 7, 7, 242, 242)
$graphics.DrawEllipse($edge, 8, 8, 240, 240)
$graphics.DrawEllipse($orangeGlow, 28, 102, 200, 54)
$graphics.DrawEllipse($orange, 24, 105, 208, 48)
$graphics.DrawArc($light, 54, 61, 148, 138, 188, 164)
$graphics.DrawLine($orange, 30, 130, 226, 130)
$graphics.FillEllipse($black, 79, 79, 98, 98)
$graphics.DrawEllipse($orange, 78, 78, 100, 100)

$pngStream = [System.IO.MemoryStream]::new()
$bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $pngStream.ToArray()

$fullPath = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($fullPath)) | Out-Null
$file = [System.IO.File]::Create($fullPath)
$writer = [System.IO.BinaryWriter]::new($file)

# ICONDIR + a single 256x256 PNG-backed ICONDIRENTRY.
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$png.Length)
$writer.Write([UInt32]22)
$writer.Write($png)

$writer.Dispose()
$file.Dispose()
$pngStream.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$space.Dispose(); $edge.Dispose(); $orangeGlow.Dispose(); $orange.Dispose(); $light.Dispose(); $black.Dispose()

Write-Host "Created Windows icon: $fullPath"
