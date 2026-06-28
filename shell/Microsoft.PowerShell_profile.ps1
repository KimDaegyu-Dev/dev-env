if (-not $env:DEV_ENV_ROOT) {
    $profileItem = Get-Item -LiteralPath $PSCommandPath
    $profileSource = if ($profileItem.Target) { $profileItem.Target } else { $PSCommandPath }
    if (-not [System.IO.Path]::IsPathRooted($profileSource)) {
        $profileSource = Join-Path $profileItem.DirectoryName $profileSource
    }
    $env:DEV_ENV_ROOT = Split-Path -Parent (Split-Path -Parent $profileSource)
}
$localBin = Join-Path $env:LOCALAPPDATA "dev-env\bin"
if (($env:PATH -split ";") -notcontains $localBin) { $env:PATH = "$localBin;$env:PATH" }

if (Get-Command mise -ErrorAction SilentlyContinue) {
    (& mise activate pwsh) | Out-String | Invoke-Expression
}
if (Get-Command starship -ErrorAction SilentlyContinue) {
    (& starship init powershell) | Out-String | Invoke-Expression
}

function gs { git status --short --branch }
function devdoctor { dev-env doctor }
function devdash { dev-env dashboard }

$localProfile = Join-Path $HOME ".config\dev-env\local.ps1"
if (Test-Path $localProfile) { . $localProfile }
