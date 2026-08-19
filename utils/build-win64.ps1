Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $ProjectDir 'release-builds'
$AppName = 'Mini4wdChrono'
$Platform = 'win32'
$Arch = 'x64'
$PackageDir = Join-Path $ReleaseDir "$AppName-$Platform-$Arch"
$Artifact = Join-Path $ReleaseDir 'Mini4wdChrono-windows-x64.zip'

Push-Location $ProjectDir
try {
    Write-Host 'Installing locked dependencies'
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed with exit code $LASTEXITCODE"
    }

    Write-Host 'Preparing release artifact paths'
    New-Item -Path $ReleaseDir -ItemType Directory -Force | Out-Null
    if (Test-Path $PackageDir) {
        Remove-Item -Path $PackageDir -Recurse -Force
    }
    if (Test-Path $Artifact) {
        Remove-Item -Path $Artifact -Force
    }

    Write-Host "Packaging $AppName for Windows $Arch"
    node .\node_modules\electron-packager\bin\electron-packager.js `
        $ProjectDir $AppName `
        "--platform=$Platform" `
        "--arch=$Arch" `
        --overwrite `
        "--icon=$(Join-Path $ProjectDir 'images/ic_launcher_web.ico')" `
        --prune=true `
        --asar `
        "--out=$ReleaseDir"
    if ($LASTEXITCODE -ne 0) {
        throw "electron-packager failed with exit code $LASTEXITCODE"
    }

    if (-not (Test-Path $PackageDir -PathType Container)) {
        throw "Expected packaged app directory was not created: $PackageDir"
    }

    Write-Host "Creating GitHub Release artifact: $(Split-Path $Artifact -Leaf)"
    Compress-Archive -Path $PackageDir -DestinationPath $Artifact -Force

    Write-Host "Done: $Artifact"
} finally {
    Pop-Location
}
