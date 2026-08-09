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

$background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 8, 2, 6))
$edge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(72, 255, 255, 255), 4)
$flowGlow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(62, 255, 51, 143), 28)
$flow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 61, 151), 9)
$violet = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(235, 137, 91, 255), 5)
$white = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 255, 255, 255), 5)
$core = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 10, 6, 13))

$graphics.FillRectangle($background, 8, 8, 240, 240)
$graphics.DrawRectangle($edge, 9, 9, 238, 238)
$graphics.DrawBezier($flowGlow, 48, 158, 68, 69, 122, 49, 204, 68)
$graphics.DrawBezier($flow, 48, 158, 68, 69, 122, 49, 204, 68)
$graphics.DrawBezier($violet, 49, 158, 94, 184, 111, 145, 128, 116)
$graphics.DrawBezier($violet, 128, 116, 143, 89, 165, 72, 204, 68)
$diamond = [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new(128, 97), [System.Drawing.Point]::new(159, 128),
    [System.Drawing.Point]::new(128, 159), [System.Drawing.Point]::new(97, 128)
)
$graphics.FillPolygon($core, $diamond)
$graphics.DrawPolygon($flow, $diamond)
$graphics.DrawLines($white, [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new(115, 128), [System.Drawing.Point]::new(126, 139), [System.Drawing.Point]::new(145, 116)
))

$pngStream = [System.IO.MemoryStream]::new()
$bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $pngStream.ToArray()
$fullPath = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($fullPath)) | Out-Null
$file = [System.IO.File]::Create($fullPath)
$writer = [System.IO.BinaryWriter]::new($file)
$writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]1)
$writer.Write([Byte]0); $writer.Write([Byte]0); $writer.Write([Byte]0); $writer.Write([Byte]0)
$writer.Write([UInt16]1); $writer.Write([UInt16]32)
$writer.Write([UInt32]$png.Length); $writer.Write([UInt32]22); $writer.Write($png)
$writer.Dispose(); $file.Dispose(); $pngStream.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
$background.Dispose(); $edge.Dispose(); $flowGlow.Dispose(); $flow.Dispose()
$violet.Dispose(); $white.Dispose(); $core.Dispose()
Write-Host "Created Windows Flow Geometry icon: $fullPath"
