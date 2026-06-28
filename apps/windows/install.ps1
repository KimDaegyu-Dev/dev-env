[CmdletBinding()]
param(
    [ValidateSet("base", "ai", "develop", "design", "all")]
    [string[]] $Profile = @("base"),

    [string] $Distribution = "Ubuntu",

    [switch] $SkipPackages,
    [switch] $SkipWsl,
    [switch] $SkipWslTools
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-WinGetImport {
    param([Parameter(Mandatory)][string] $Manifest)

    Write-Host "`n==> Installing packages from $(Split-Path $Manifest -Leaf)"
    & winget.exe import `
        --import-file $Manifest `
        --ignore-unavailable `
        --accept-package-agreements `
        --accept-source-agreements `
        --disable-interactivity

    if ($LASTEXITCODE -ne 0) {
        throw "WinGet import failed with exit code ${LASTEXITCODE}: $Manifest"
    }
}

if ($env:OS -ne "Windows_NT") {
    throw "This script must be run from Windows PowerShell or PowerShell on Windows."
}

if (-not $SkipWsl -and -not (Test-IsAdministrator)) {
    throw "WSL setup requires an elevated terminal. Reopen PowerShell as Administrator and run this command again."
}

if (-not $SkipPackages) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw "WinGet was not found. Install or update App Installer from Microsoft Store first."
    }

    $profilesToInstall = @("base")
    if ($Profile -contains "all") {
        $profilesToInstall += @("ai", "develop", "design")
    }
    else {
        $profilesToInstall += @($Profile | Where-Object { $_ -ne "base" })
    }

    foreach ($name in $profilesToInstall | Select-Object -Unique) {
        $fileName = if ($name -eq "base") { "winget.json" } else { "winget.$name.json" }
        Invoke-WinGetImport -Manifest (Join-Path $PSScriptRoot $fileName)
    }
}

if (-not $SkipWsl) {
    Write-Host "`n==> Configuring WSL 2"

    $installedDistributions = @(
        & wsl.exe --list --quiet 2>$null |
            ForEach-Object { ($_ -replace "`0", "").Trim() } |
            Where-Object { $_ }
    )

    if ($installedDistributions -notcontains $Distribution) {
        Write-Host "Installing WSL distribution: $Distribution"
        & wsl.exe --install --distribution $Distribution --no-launch
        if ($LASTEXITCODE -ne 0) {
            throw "WSL installation failed with exit code $LASTEXITCODE."
        }
    }
    else {
        Write-Host "$Distribution is already installed; skipping distribution installation."
    }

    & wsl.exe --set-default-version 2
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Could not set WSL 2 as the default. Restart Windows, then rerun with -SkipPackages."
    }

    if (-not $SkipWslTools) {
        Write-Host "`n==> Installing CLI tools inside $Distribution"
        Write-Host "The first WSL launch may ask you to create a Linux user."

        & wsl.exe --distribution $Distribution --cd $PSScriptRoot -- bash "./wsl/install.sh"
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "WSL tools could not be installed yet. Restart Windows, then rerun: .\apps\windows\install.ps1 -SkipPackages"
        }
    }
}

Write-Host "`nWindows environment setup finished."
