param(
    [switch]$RefreshQMD
)

# From an existing, locally cloned MyKnowledgeVault on Windows.
# Run this after a successful git pull. No existing skill is overwritten.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$vault = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $vault

try {
    $frontend = Join-Path $vault '.agents\skills\frontend-design\SKILL.md'
    $uxRoot   = Join-Path $vault '.agents\skills\ui-ux-pro-max'
    $uxSkill  = Join-Path $uxRoot 'SKILL.md'
    $uxSearch = Join-Path $uxRoot 'scripts\search.py'

    if (-not (Test-Path -LiteralPath $frontend)) {
        throw 'Frontend Design is missing. Pull main before running this script.'
    }
    Write-Host 'Frontend Design: present in Git repository.'

    if ((Test-Path -LiteralPath $uxSkill) -and (Test-Path -LiteralPath $uxSearch)) {
        Write-Host 'UI UX Pro Max: already installed; leaving it unchanged.'
    }
    else {
        if (Test-Path -LiteralPath $uxRoot) {
            throw 'Partial UI UX Pro Max directory found. Review files manually before reinstalling; this script will not overwrite them.'
        }

        $npx = Get-Command 'npx.cmd' -ErrorAction SilentlyContinue
        if ($null -eq $npx) { $npx = Get-Command 'npx' -ErrorAction SilentlyContinue }
        if ($null -eq $npx) {
            throw 'Node.js / npx is unavailable. Install Node.js, then rerun this script.'
        }

        # Checked upstream CLI: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
        # Generates .agents/skills/ui-ux-pro-max, including search.py and design data.
        & $npx.Source '-y' 'ui-ux-pro-max-cli@2.15.0' 'init' '--ai' 'codex'
        if ($LASTEXITCODE -ne 0) { throw "UI UX Pro Max installer failed: exit code $LASTEXITCODE" }
        if (-not ((Test-Path -LiteralPath $uxSkill) -and (Test-Path -LiteralPath $uxSearch))) {
            throw 'Installer exited, but expected SKILL.md / scripts/search.py were not found.'
        }
        Write-Host 'UI UX Pro Max: installed in this vault.'
    }

    if ($RefreshQMD) {
        $npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
        if ($null -eq $npm) { throw 'npm.cmd is required for QMD maintenance on Windows.' }

        $env:QMD_CONFIG_DIR = Join-Path $vault '.qmd'
        $env:INDEX_PATH = Join-Path $vault '.qmd\index.sqlite'
        # This setting is for this vault's already reviewed local .qmd/index.yml only.
        $env:QMD_TRUST_LOCAL_CONFIG = '1'

        & $npm.Source 'run' '--silent' 'qmd' '--' 'update'
        if ($LASTEXITCODE -ne 0) { throw "qmd update failed: $LASTEXITCODE" }
        & $npm.Source 'run' '--silent' 'qmd' '--' 'embed' '--max-docs-per-batch' '16' '--max-batch-mb' '8'
        if ($LASTEXITCODE -ne 0) { throw "qmd embed failed: $LASTEXITCODE" }
        & $npm.Source 'run' '--silent' 'qmd' '--' 'status'
        if ($LASTEXITCODE -ne 0) { throw "qmd status failed: $LASTEXITCODE" }
        Write-Host 'Review the QMD status output and confirm Pending: 0.'
    }

    Write-Host 'Skills ready. Restart Codex to refresh discovered skills.'
    Write-Host 'Local UI UX Pro Max generated files are uncommitted; review git status before choosing to commit.'
}
finally {
    Pop-Location
}
