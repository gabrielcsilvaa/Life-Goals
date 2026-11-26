$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExecutable = Join-Path $projectRoot '.venv\Scripts\python.exe'
$backendDirectory = Join-Path $projectRoot 'backend'

& $pythonExecutable (Join-Path $PSScriptRoot 'setup_local_db.py')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao validar banco/configuração. Confira backend/.env.' }

# Restart only API processes belonging to this project's absolute backend path.
$apiListener = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue
if ($apiListener) {
    $processSnapshot = @(Get-CimInstance Win32_Process)
    $ownedIds = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($candidate in $processSnapshot) {
        if ($candidate.Name -match '^python' -and $candidate.CommandLine -match 'uvicorn config.asgi:application' -and $candidate.CommandLine.Contains($backendDirectory)) {
            [void]$ownedIds.Add([int]$candidate.ProcessId)
        }
    }
    do {
        $addedChild = $false
        foreach ($candidate in $processSnapshot) {
            if ($ownedIds.Contains([int]$candidate.ParentProcessId) -and $ownedIds.Add([int]$candidate.ProcessId)) { $addedChild = $true }
        }
    } while ($addedChild)
    foreach ($listener in $apiListener) {
        if (-not $ownedIds.Contains([int]$listener.OwningProcess)) { throw 'A porta 8000 pertence a outro processo; ele foi preservado.' }
    }
    foreach ($candidate in $processSnapshot) {
        if ($ownedIds.Contains([int]$candidate.ProcessId)) {
            $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($candidate.ProcessId)"
            if ($current -and $current.CreationDate -eq $candidate.CreationDate) { Stop-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue }
        }
    }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 100
    }
}
$apiProcess = Start-Process -FilePath $pythonExecutable -WorkingDirectory $projectRoot -ArgumentList @('-m','uvicorn','config.asgi:application','--app-dir',"`"$backendDirectory`"",'--host','0.0.0.0','--port','8000') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.local\api.stdout.log') -RedirectStandardError (Join-Path $projectRoot '.local\api.stderr.log') -PassThru
Set-Content -LiteralPath (Join-Path $projectRoot '.local\api.pid') -Value $apiProcess.Id
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8000/health/' -TimeoutSec 2
        if ($health.service -eq 'life-goals') { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 200 }
}
if (-not $ready) { throw 'API não iniciou; consulte .local/api.stderr.log.' }
Write-Host 'PostgreSQL e backend prontos. API: http://127.0.0.1:8000'
