param([switch]$BackendOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
& (Join-Path $projectRoot 'scripts\Start-LifeGoals.ps1')
if ($BackendOnly) { return }

$mobileDirectory = Join-Path $projectRoot 'mobile'
$expoListener = Get-NetTCPConnection -State Listen -LocalPort 8082 -ErrorAction SilentlyContinue
if ($expoListener) {
    $expoOwner = Get-CimInstance Win32_Process -Filter "ProcessId=$($expoListener[0].OwningProcess)"
    if (-not $expoOwner -or -not $expoOwner.CommandLine.Contains($mobileDirectory) -or $expoOwner.CommandLine -notmatch 'expo.*start') {
        throw 'A porta 8082 pertence a outro processo; ele foi preservado.'
    }
    $mobileEnv = Get-Item -LiteralPath (Join-Path $mobileDirectory '.env.local')
    if ($mobileEnv.LastWriteTimeUtc -gt $expoOwner.CreationDate.ToUniversalTime()) {
        Stop-Process -Id $expoOwner.ProcessId
        $expoListener = $null
    }
}
Push-Location $mobileDirectory
try {
    if ($expoListener) {
        $apiEnvironmentLine = Get-Content -LiteralPath (Join-Path $mobileDirectory '.env.local') | Where-Object { $_ -match '^EXPO_PUBLIC_API_URL=' } | Select-Object -First 1
        $apiAddress = [Uri](($apiEnvironmentLine -replace '^EXPO_PUBLIC_API_URL=', '').Trim("'`" "))
        $response = Invoke-WebRequest -UseBasicParsing "http://$($apiAddress.Host):8082" -Headers @{'Expo-Platform'='ios';'Accept'='application/expo+json'} -TimeoutSec 10
        $manifestText = if ($response.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($response.Content) } else { $response.Content }
        $manifest = $manifestText | ConvertFrom-Json
        if ($manifest.extra.expoClient.slug -ne 'life-goals') { throw 'O Expo na porta 8082 pertence a outro projeto.' }
        $launchAddress = [Uri]$manifest.launchAsset.url
        Write-Host "Expo já está rodando: exp://$($launchAddress.Host):8082"
    } else {
        & npx expo start --go --lan --port 8082
        if ($LASTEXITCODE -ne 0) { throw 'Expo encerrou com erro.' }
    }
} finally { Pop-Location }
