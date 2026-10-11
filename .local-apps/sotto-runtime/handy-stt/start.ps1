$ErrorActionPreference = 'Stop'
try {
    $status = Invoke-RestMethod 'http://127.0.0.1:8091/health' -TimeoutSec 2
    if ($status.provider -eq 'Handy') { exit 0 }
} catch { }
$python = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/pythonw.exe'
$script = Join-Path $PSScriptRoot 'server.py'
Start-Process -FilePath $python -ArgumentList ('"' + $script + '"') -WindowStyle Hidden
