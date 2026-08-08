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

$background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 9, 12, 12))
$edge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 57, 76, 72), 6)
$cyanGlow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(62, 41, 199, 173), 24)
$purpleGlow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(55, 112, 219, 200), 20)
$cyan = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 41, 199, 173), 8)
$purple = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 163, 226, 214), 5)
$white = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(190, 255, 255, 255), 3)
$orb = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235, 25, 126, 111))
$shine = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(175, 255, 255, 255))

$graphics.FillRectangle($background, 8, 8, 240, 240)
$graphics.DrawRectangle($edge, 9, 9, 238, 238)
$graphics.DrawArc($cyanGlow, -20, 46, 290, 132, 192, 158)
$graphics.DrawArc($cyan, -20, 46, 290, 132, 192, 158)
$graphics.DrawArc($purpleGlow, -14, 108, 284, 120, 190, 160)
$graphics.DrawArc($purple, -14, 108, 284, 120, 190, 160)
$graphics.FillEllipse($orb, 84, 75, 88, 88)
$graphics.DrawEllipse($white, 84, 75, 88, 88)
$graphics.FillEllipse($shine, 101, 91, 23, 12)

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
$background.Dispose(); $edge.Dispose(); $cyanGlow.Dispose(); $purpleGlow.Dispose()
$cyan.Dispose(); $purple.Dispose(); $white.Dispose(); $orb.Dispose(); $shine.Dispose()
Write-Host "Created Windows Organic Flow icon: $fullPath"
