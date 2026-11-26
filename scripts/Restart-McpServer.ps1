$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot '.local\mcp-public.json'
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$rootProcess = Get-Process -Id $state.serverPid -ErrorAction SilentlyContinue
if ($rootProcess) {
    $details = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.serverPid)"
    if ($rootProcess.StartTime.ToUniversalTime().Ticks -ne ([datetime]$state.serverStarted).ToUniversalTime().Ticks -or -not $details.CommandLine.Contains('config.public_asgi:application')) { throw 'O processo mudou; ele foi preservado.' }
    $snapshot = @(Get-CimInstance Win32_Process)
    $owned = [System.Collections.Generic.HashSet[int]]::new()
    [void]$owned.Add([int]$state.serverPid)
    do {
        $added = $false
        foreach ($candidate in $snapshot) {
            if ($owned.Contains([int]$candidate.ParentProcessId) -and $owned.Add([int]$candidate.ProcessId)) { $added = $true }
        }
    } while ($added)
    foreach ($candidate in $snapshot) {
        if ($owned.Contains([int]$candidate.ProcessId)) {
            $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($candidate.ProcessId)"
            if ($current -and $current.CreationDate -eq $candidate.CreationDate) { Stop-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue }
        }
    }
}
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (-not (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 100
}
if (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue) { throw 'A porta pública segue ocupada.' }
$backendPath = Join-Path $projectRoot 'backend'
$server = Start-Process -FilePath (Join-Path $projectRoot '.venv\Scripts\python.exe') -WorkingDirectory $projectRoot -ArgumentList @('-m','uvicorn','config.public_asgi:application','--app-dir',"`"$backendPath`"",'--host','127.0.0.1','--port','8001','--no-access-log','--no-proxy-headers') -Environment @{OAUTH_PUBLIC_ORIGIN=$state.origin;MCP_PUBLIC_URL=$state.mcpUrl} -WindowStyle Hidden -RedirectStandardError (Join-Path $projectRoot '.local\mcp-public.stderr.log') -RedirectStandardOutput (Join-Path $projectRoot '.local\mcp-public.stdout.log') -PassThru
$state.serverPid = $server.Id
$state.serverStarted = $server.StartTime.ToUniversalTime().ToString('o')
$state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if ($server.HasExited) { throw 'O servidor público terminou; consulte .local/mcp-public.stderr.log.' }
    try {
        $metadata = Invoke-RestMethod 'http://127.0.0.1:8001/.well-known/oauth-protected-resource/mcp' -TimeoutSec 2
        if ($metadata.resource -eq $state.mcpUrl) { Write-Output "Servidor reiniciado; URL preservada: $($state.mcpUrl)"; exit 0 }
    } catch { Start-Sleep -Milliseconds 200 }
}
throw 'Servidor não respondeu após reiniciar.'
