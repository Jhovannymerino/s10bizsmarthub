Write-Host ""
Write-Host "S10 BizSmartHub — Auto-Sync" -ForegroundColor Cyan
Write-Host "Esperando conexion a la red CMO (192.168.1.51)..." -ForegroundColor Yellow
Write-Host "Conecta FortiClient VPN 'INTEGRAL' para continuar." -ForegroundColor Yellow
Write-Host ""

$target = "192.168.1.51"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

while ($true) {
    $ping = Test-Connection -ComputerName $target -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        Write-Host "[OK] Red CMO alcanzable. Iniciando sync..." -ForegroundColor Green
        Write-Host ""
        $year = (Get-Date).Year
        Set-Location $agentDir
        node sync-agent.js --year=$year
        Write-Host ""
        Write-Host "Sync completado. Presiona Enter para salir."
        Read-Host
        exit 0
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Esperando VPN..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    }
}
