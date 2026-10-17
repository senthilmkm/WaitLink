Add-Type -AssemblyName System.Drawing

function Save-ResizedImage {
    param(
        [string]$SourcePath,
        [string]$TargetPath,
        [int]$Width = 512,
        [int]$Height = 512
    )

    $src = [System.Drawing.Image]::FromFile($SourcePath)
    $dest = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($dest)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.DrawImage($src, 0, 0, $Width, $Height)
    $dest.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $dest.Dispose()
    $src.Dispose()
}

Save-ResizedImage -SourcePath "c:\Workspaces\WaitLink\assets\waitlink_stripe_icon.jpg" -TargetPath "c:\Workspaces\WaitLink\assets\waitlink_stripe_icon.png" -Width 512 -Height 512
Save-ResizedImage -SourcePath "c:\Workspaces\WaitLink\assets\waitlink_stripe_logo.jpg" -TargetPath "c:\Workspaces\WaitLink\assets\waitlink_stripe_logo.png" -Width 512 -Height 512

Get-ChildItem "c:\Workspaces\WaitLink\assets\waitlink_stripe_*" | Select-Object Name, Length
