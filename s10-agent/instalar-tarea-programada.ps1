# S10 BizSmartHub — Instalador de tarea programada
# Ejecutar como Administrador en una PC dentro de la red CMO
# El agente correrá automáticamente cada día de semana a las 7:00 AM

$ErrorActionPreference = "Stop"

$AGENT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$NODE     = (Get-Command node -ErrorAction SilentlyContinue)?.Source
$SCRIPT   = Join-Path $AGENT_DIR "sync-agent.js"
$LOG_DIR  = Join-Path $AGENT_DIR "logs"
$TASK     = "S10BizSmartHub-Sync"

if (-not $NODE) {
    Write-Error "Node.js no encontrado. Instálalo desde https://nodejs.org y vuelve a ejecutar."
    exit 1
}

if (-not (Test-Path $SCRIPT)) {
    Write-Error "No se encontró sync-agent.js en $AGENT_DIR"
    exit 1
}

New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

# Instalar dependencias si faltan
if (-not (Test-Path (Join-Path $AGENT_DIR "node_modules"))) {
    Write-Output "Instalando dependencias npm..."
    Push-Location $AGENT_DIR
    npm install
    Pop-Location
}

$YEAR = (Get-Date).Year
$ACTION = New-ScheduledTaskAction `
    -Execute $NODE `
    -Argument "`"$SCRIPT`" --year=$YEAR" `
    -WorkingDirectory $AGENT_DIR

$TRIGGER = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday `
    -At "07:00AM"

$SETTINGS = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable

$PRINCIPAL = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# Registrar tarea
if (Get-ScheduledTask -TaskName $TASK -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TASK -Confirm:$false
    Write-Output "Tarea anterior eliminada."
}

Register-ScheduledTask `
    -TaskName $TASK `
    -Action $ACTION `
    -Trigger $TRIGGER `
    -Settings $SETTINGS `
    -Principal $PRINCIPAL `
    -Description "Sincroniza datos S10 con BizSmartHub VPS — lun-vie 7:00 AM" | Out-Null

Write-Output ""
Write-Output "Tarea '$TASK' instalada correctamente."
Write-Output "Horario: lunes a viernes 07:00 AM"
Write-Output "Node: $NODE"
Write-Output "Script: $SCRIPT"
Write-Output ""

# Ejecutar ahora mismo para probar
Write-Output "Ejecutando sincronización inicial..."
$result = Start-Process $NODE `
    -ArgumentList "`"$SCRIPT`" --year=$YEAR" `
    -WorkingDirectory $AGENT_DIR `
    -Wait -PassThru -NoNewWindow
Write-Output "Resultado: exit code $($result.ExitCode)"
