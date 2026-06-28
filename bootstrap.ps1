[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $DevEnvArguments
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot

if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
    throw "WinGet is required to bootstrap and manage Windows applications."
}

$nodeReady = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeMajor = [int]((& node -p "Number(process.versions.node.split('.')[0])").Trim())
    $nodeReady = $nodeMajor -ge 24
}

if (-not $nodeReady) {
    & winget.exe install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Node.js installation failed." }
    $env:PATH = "$env:ProgramFiles\nodejs;$env:PATH"
}

if (-not (Get-Command mise -ErrorAction SilentlyContinue)) {
    & winget.exe install --id jdx.mise --exact --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) { throw "mise installation failed." }
    $wingetLinks = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links"
    $env:PATH = "$wingetLinks;$env:PATH"
}
if (-not (Get-Command mise -ErrorAction SilentlyContinue)) {
    throw "mise was installed but is not visible yet. Start a new PowerShell and run bootstrap.ps1 again."
}

& corepack enable pnpm
if ($LASTEXITCODE -ne 0) { & npm install --global pnpm }

Push-Location $RepoRoot
try {
    & pnpm install
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed." }
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw "pnpm build failed." }

    $bin = Join-Path $env:LOCALAPPDATA "dev-env\bin"
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    $launcher = Join-Path $bin "dev-env.cmd"
    "@echo off`r`nnode `"$RepoRoot\packages\cli\dist\index.js`" %*`r`n" | Set-Content -Encoding Ascii $launcher

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (($userPath -split ";") -notcontains $bin) {
        [Environment]::SetEnvironmentVariable("Path", "$bin;$userPath", "User")
    }
    $env:PATH = "$bin;$env:PATH"
    & node "$RepoRoot\packages\cli\dist\index.js" setup @DevEnvArguments
}
finally {
    Pop-Location
}
