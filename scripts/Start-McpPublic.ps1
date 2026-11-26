$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDirectory = Join-Path $projectRoot '.local'
$statePath = Join-Path $localDirectory 'mcp-public.json'
$binaryPath = Join-Path $localDirectory 'tools\cloudflared.exe'
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$backendPath = Join-Path $projectRoot 'backend'
$expectedSha256 = '555b46c85582461d189cac30d14ad05480d612613801be9f110b8ce08c5b2113'
if (Test-Path -LiteralPath $statePath) {
    $savedState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $tunnelProcess = Get-Process -Id $savedState.tunnelPid -ErrorAction SilentlyContinue
    if (-not $tunnelProcess -or $tunnelProcess.StartTime.ToUniversalTime().Ticks -ne ([datetime]$savedState.tunnelStarted).ToUniversalTime().Ticks) {
        throw 'O túnel anterior encerrou. Execute Stop-McpPublic.ps1 e inicie novamente.'
    }
    $metadata = Invoke-RestMethod 'http://127.0.0.1:8001/.well-known/oauth-protected-resource/mcp' -TimeoutSec 3
    if ($metadata.resource -ne $savedState.mcpUrl) { throw 'O servidor público não corresponde ao estado registrado.' }
    Write-Output "MCP registrado: $($savedState.mcpUrl)"
    Write-Output 'Para trocar o endereço, encerre os processos com Stop-McpPublic.ps1 primeiro.'
    exit 0
}
if (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue) { throw 'A porta 8001 está ocupada; o processo foi preservado.' }
New-Item -ItemType Directory -Force -Path (Split-Path $binaryPath) | Out-Null
if (-not (Test-Path -LiteralPath $binaryPath)) {
    Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/download/2026.11.2/cloudflared-windows-amd64.exe' -OutFile $binaryPath
}
if ((Get-FileHash -LiteralPath $binaryPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedSha256) { throw 'Falha na verificação SHA256 do cloudflared.' }
$logPath = Join-Path $localDirectory 'mcp-tunnel.stderr.log'
$tunnel = Start-Process -FilePath $binaryPath -ArgumentList @('--no-autoupdate','tunnel','--url','http://127.0.0.1:8001','--protocol','http2') -WindowStyle Hidden -RedirectStandardError $logPath -RedirectStandardOutput (Join-Path $localDirectory 'mcp-tunnel.stdout.log') -PassThru
$publicOrigin = $null
for ($attempt = 0; $attempt -lt 100; $attempt++) {
    if ($tunnel.HasExited) { throw 'O túnel terminou. Consulte .local/mcp-tunnel.stderr.log.' }
    $logText = Get-Content -LiteralPath $logPath -Raw -ErrorAction SilentlyContinue
    if ($logText -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $publicOrigin = $Matches[0]; break }
    Start-Sleep -Milliseconds 200
}
if (-not $publicOrigin) { throw "O túnel não forneceu endereço. Processo: $($tunnel.Id)." }
$server = Start-Process -FilePath $pythonPath -WorkingDirectory $projectRoot -ArgumentList @('-m','uvicorn','config.public_asgi:application','--app-dir',"`"$backendPath`"",'--host','127.0.0.1','--port','8001','--no-access-log','--no-proxy-headers') -Environment @{OAUTH_PUBLIC_ORIGIN=$publicOrigin;MCP_PUBLIC_URL="$publicOrigin/mcp"} -WindowStyle Hidden -RedirectStandardError (Join-Path $localDirectory 'mcp-public.stderr.log') -RedirectStandardOutput (Join-Path $localDirectory 'mcp-public.stdout.log') -PassThru
$state = @{origin=$publicOrigin;mcpUrl="$publicOrigin/mcp";tunnelPid=$tunnel.Id;tunnelStarted=$tunnel.StartTime.ToUniversalTime().ToString('o');serverPid=$server.Id;serverStarted=$server.StartTime.ToUniversalTime().ToString('o')}
$state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if ($server.HasExited) { throw 'O servidor terminou. Consulte .local/mcp-public.stderr.log e execute Stop-McpPublic.ps1.' }
    try {
        $metadata = Invoke-RestMethod 'http://127.0.0.1:8001/.well-known/oauth-protected-resource/mcp' -TimeoutSec 2
        if ($metadata.resource -eq "$publicOrigin/mcp") { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 200 }
}
if (-not $ready) { throw 'Servidor não ficou pronto. Execute Stop-McpPublic.ps1 antes de tentar novamente.' }
Write-Output "URL MCP para o ChatGPT: $publicOrigin/mcp"
Write-Output 'Autenticação: OAuth. Registro automático; deixe Client ID e segredo vazios.'
Write-Output 'Endereço temporário. Mantenha o computador ligado; para encerrar: .\scripts\Stop-McpPublic.ps1'
