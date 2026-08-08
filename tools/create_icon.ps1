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

$space = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 10, 9, 13))
$edge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 55, 49, 63), 6)
$glow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 255, 102, 47), 18)
$mars = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 196, 57, 29))
$light = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(125, 255, 151, 83))
$shade = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(115, 38, 11, 18))
$crater = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(92, 71, 17, 20))
$terrain = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(100, 255, 179, 116), 3)
$star = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 255, 211, 178))

$graphics.FillEllipse($space, 7, 7, 242, 242)
$graphics.DrawEllipse($edge, 8, 8, 240, 240)
$graphics.DrawEllipse($glow, 46, 48, 164, 164)
$graphics.FillEllipse($mars, 52, 54, 152, 152)
$graphics.FillEllipse($light, 61, 61, 92, 94)
$graphics.FillEllipse($shade, 136, 54, 68, 152)
$graphics.FillEllipse($crater, 77, 91, 39, 25)
$graphics.FillEllipse($crater, 119, 139, 48, 31)
$graphics.FillEllipse($crater, 92, 162, 22, 14)
$graphics.DrawArc($terrain, 63, 104, 130, 56, 5, 165)
$graphics.DrawArc($terrain, 66, 128, 121, 58, 8, 163)
$graphics.FillEllipse($star, 45, 47, 5, 5)
$graphics.FillEllipse($star, 208, 71, 4, 4)
$graphics.FillEllipse($star, 211, 186, 5, 5)

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
$space.Dispose(); $edge.Dispose(); $glow.Dispose(); $mars.Dispose(); $light.Dispose()
$shade.Dispose(); $crater.Dispose(); $terrain.Dispose(); $star.Dispose()

Write-Host "Created Windows Mars icon: $fullPath"
