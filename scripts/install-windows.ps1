param(
    [ValidateSet("common", "frontend", "rust", "cpp", "backend", "ai-python", "fullstack", "graphics", "java")]
    [string]$Profile,
    [switch]$Open,
    [string]$Path = (Get-Location).Path,
    [switch]$WhatIf
)

$RootDir = Split-Path -Parent $PSScriptRoot

function Get-ProfileNameFromPath {
    param([string]$TargetPath)

    if ($TargetPath -like "*\GitHub\Frontend\*") { return "Frontend" }
    if ($TargetPath -like "*\GitHub\Rust\*") { return "Rust" }
    if ($TargetPath -like "*\GitHub\C++\*") { return "C++" }
    if ($TargetPath -like "*\GitHub\Backend\*") { return "Backend" }
    if ($TargetPath -like "*\GitHub\AI-Python\*") { return "AI(Python)" }
    if ($TargetPath -like "*\GitHub\Fullstack\*") { return "Fullstack" }
    if ($TargetPath -like "*\GitHub\Graphics\*") { return "Graphics" }
    return "Default"
}

function Install-ProfileExtensions {
    param([string]$ProfileKey)

    $ExtensionFile = Join-Path $RootDir "vscode\$ProfileKey\extensions.json"
    if (-not (Test-Path $ExtensionFile)) {
        throw "Missing extension file: $ExtensionFile"
    }

    $Extensions = (Get-Content $ExtensionFile -Raw | ConvertFrom-Json).recommendations
    foreach ($ExtensionId in $Extensions) {
        if ([string]::IsNullOrWhiteSpace($ExtensionId)) { continue }
        if ($WhatIf) {
            Write-Host "Would install $ExtensionId"
        } else {
            Write-Host "Installing $ExtensionId"
            code --install-extension $ExtensionId
        }
    }
}

function Open-WithDetectedProfile {
    param([string]$TargetPath)

    $ProfileName = Get-ProfileNameFromPath -TargetPath $TargetPath
    if ($WhatIf) {
        Write-Host "Would open $TargetPath with VS Code profile: $ProfileName"
    } else {
        Write-Host "Opening $TargetPath with VS Code profile: $ProfileName"
        code --profile $ProfileName $TargetPath
    }
}

if ($Open) {
    Open-WithDetectedProfile -TargetPath $Path
    exit 0
}

if ($Profile) {
    Install-ProfileExtensions -ProfileKey $Profile
    exit 0
}

Write-Host "Usage:"
Write-Host "  .\scripts\install-windows.ps1 -Profile frontend [-WhatIf]"
Write-Host "  .\scripts\install-windows.ps1 -Open [-Path <path>] [-WhatIf]"
Write-Host "This script does not run destructive commands."
