Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $ProjectDir 'release-builds'
$AppName = 'Mini4wdChrono'
$Platform = 'win32'
$Arch = 'x64'
$PackageDir = Join-Path $ReleaseDir "$AppName-$Platform-$Arch"
$Artifact = Join-Path $ReleaseDir 'Mini4wdChrono-windows-x64.zip'
$NodeModulesDir = Join-Path $ProjectDir 'node_modules'

function Assert-BuildToolchain {
    $NodeVersion = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to run Node.js. Install Node.js 22.13.0 or newer, then reopen PowerShell.'
    }

    $NpmVersion = (& npm --version).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to run npm. Install Node.js 22.13.0 or newer, then reopen PowerShell.'
    }

    $NodeMajor = [int](($NodeVersion -replace '^v', '').Split('.')[0])
    $NodeMinor = [int](($NodeVersion -replace '^v', '').Split('.')[1])
    $NpmMajor = [int]($NpmVersion.Split('.')[0])
    Write-Host "Using Node.js $NodeVersion and npm $NpmVersion"

    if ($NodeMajor -lt 22 -or ($NodeMajor -eq 22 -and $NodeMinor -lt 13) -or $NpmMajor -lt 9) {
        throw "This build requires Node.js 22.13.0+ and npm 9+ (found Node.js $NodeVersion and npm $NpmVersion). Install Node.js 22.13.0 or newer, then reopen PowerShell."
    }

    # Get-Command returns every match on PATH, so keep only the one that actually runs.
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $PythonCommand) {
        throw 'This build rebuilds native modules and requires Python 3.8+ on PATH. Install Python 3.8+ and ensure it takes priority on PATH, then reopen PowerShell.'
    }

    $PythonVersionCode = (& python -c 'import sys; print(sys.version_info[0] * 100 + sys.version_info[1])').Trim()
    if ($LASTEXITCODE -ne 0 -or [int]$PythonVersionCode -lt 308) {
        throw 'This build rebuilds native modules and requires Python 3.8+ on PATH. Install Python 3.8+ and ensure it takes priority on PATH, then reopen PowerShell.'
    }

    $PythonVersion = "$([math]::Floor([int]$PythonVersionCode / 100)).$([int]$PythonVersionCode % 100)"
    Write-Host "Using Python $PythonVersion for native modules: $($PythonCommand.Source)"
}

function Install-LockedDependencies {
    function Invoke-NpmCi {
        # npm writes warnings and lifecycle-script output to stderr. Keep it visible,
        # but do not let StrictMode turn a warning into a terminating PowerShell error.
        $PreviousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            npm ci
        } finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }
    }

    Write-Host 'Installing locked dependencies'
    Invoke-NpmCi
    if ($LASTEXITCODE -eq 0) {
        return
    }

    # npm ci normally removes node_modules itself. On Windows, a partially removed
    # directory can instead cause ENOTEMPTY (often due to a file handle held by an
    # editor, antivirus, or a previous npm process). Remove that known project
    # directory and make one clean retry.
    if (-not (Test-Path $NodeModulesDir -PathType Container)) {
        throw "npm ci failed with exit code $LASTEXITCODE"
    }

    $ResolvedNodeModulesDir = [System.IO.Path]::GetFullPath($NodeModulesDir)
    $ExpectedNodeModulesDir = [System.IO.Path]::GetFullPath((Join-Path $ProjectDir 'node_modules'))
    if ($ResolvedNodeModulesDir -ne $ExpectedNodeModulesDir) {
        throw "Refusing to remove unexpected dependency directory: $ResolvedNodeModulesDir"
    }

    Write-Warning 'npm ci could not clean node_modules. Removing it and retrying once.'
    $CleanupAttempts = 10
    $NodeModulesRemoved = $false
    for ($Attempt = 1; $Attempt -le $CleanupAttempts; $Attempt++) {
        if (-not (Test-Path $ResolvedNodeModulesDir -PathType Container)) {
            $NodeModulesRemoved = $true
            break
        }

        try {
            Remove-Item -LiteralPath $ResolvedNodeModulesDir -Recurse -Force -ErrorAction Stop
            $NodeModulesRemoved = $true
            break
        } catch {
            if (-not (Test-Path $ResolvedNodeModulesDir -PathType Container)) {
                $NodeModulesRemoved = $true
                break
            }

            if ($Attempt -eq $CleanupAttempts) {
                throw "Could not remove node_modules after $CleanupAttempts attempts. Close processes using the project directory and try again. $($_.Exception.Message)"
            }

            Write-Warning "Could not remove node_modules (attempt $Attempt of $CleanupAttempts); retrying."
            Start-Sleep -Seconds 2
        }
    }

    if (-not $NodeModulesRemoved) {
        throw "Could not remove node_modules after $CleanupAttempts attempts. Close processes using the project directory and try again."
    }

    Invoke-NpmCi
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed after a clean retry with exit code $LASTEXITCODE"
    }
}

Push-Location $ProjectDir
try {
    Assert-BuildToolchain

    Install-LockedDependencies

    Write-Host 'Preparing release artifact paths'
    New-Item -Path $ReleaseDir -ItemType Directory -Force | Out-Null
    if (Test-Path $PackageDir) {
        Remove-Item -Path $PackageDir -Recurse -Force
    }
    if (Test-Path $Artifact) {
        Remove-Item -Path $Artifact -Force
    }

    Write-Host "Packaging $AppName for Windows $Arch"

    $PackagerCli = Join-Path $ProjectDir 'node_modules\@electron\packager\bin\electron-packager.mjs'
    if (-not (Test-Path $PackagerCli -PathType Leaf)) {
        throw "@electron/packager CLI not found: $PackagerCli"
    }

    $PackagerIcon = Join-Path $ProjectDir 'images\ic_launcher_web.ico'
    $PackagerArgs = @(
        $PackagerCli
        $ProjectDir
        $AppName
        "--platform=$Platform"
        "--arch=$Arch"
        '--overwrite'
        "--icon=$PackagerIcon"
        '--prune=true'
        '--asar'
        "--out=$ReleaseDir"
    )

    # @electron/packager writes normal progress messages to stderr. Keep it visible as
    # plain output, but do not let StrictMode turn progress text into a terminating
    # PowerShell error. Passing an argument array avoids any manual quoting.
    $PreviousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & node @PackagerArgs 2>&1 | ForEach-Object { Write-Host "$_" }
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }

    $PackagerExitCode = $LASTEXITCODE
    if ($PackagerExitCode -ne 0) {
        throw "@electron/packager failed with exit code $PackagerExitCode"
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
