$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot '.local\mcp-public.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Output 'Nenhum túnel público registrado.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($entry in @(@{id=$state.serverPid;started=$state.serverStarted;needle='config.public_asgi:application'},@{id=$state.tunnelPid;started=$state.tunnelStarted;needle=(Join-Path $projectRoot '.local\tools\cloudflared.exe')})) {
    $item = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
    if (-not $item) { continue }
    $details = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.id)"
    if ($item.StartTime.ToUniversalTime().Ticks -ne ([datetime]$entry.started).ToUniversalTime().Ticks -or -not $details.CommandLine.Contains($entry.needle)) {
        Write-Output "O processo original $($entry.id) encerrou; o processo atual foi preservado."
        continue
    }
    $snapshot = @(Get-CimInstance Win32_Process)
    $owned = [System.Collections.Generic.HashSet[int]]::new()
    [void]$owned.Add([int]$entry.id)
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
Remove-Item -LiteralPath $statePath
Write-Output 'MCP público encerrado. O aplicativo e a API local continuam disponíveis.'
