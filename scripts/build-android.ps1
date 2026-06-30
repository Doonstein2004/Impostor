<#
.SYNOPSIS
    Compila la app Android de Impostor Futbol.

.DESCRIPTION
    Wrapper sobre Gradle que configura Java 17 y compila la variante pedida.
    Por defecto genera un APK arm64 debug (~55 MB) en vez del universal (~216 MB).

    Tamanos esperados segun modo:
      arm64  debug              ~  55 MB  <- default, para probar en el celular
      arm64  release            ~  50 MB  (sin R8)
      arm64  release + Minify   ~  28 MB
      universal debug           ~ 216 MB  (todas las ABIs, comportamiento previo)
      AAB    release            ~  45 MB  (Play Store - split por dispositivo ~20 MB)

    Por que el universal pesa tanto:
      - 4 ABIs x libs nativas (RN + Reanimated + LiveKit/WebRTC)
      - WebRTC pesa ~30-40 MB por ABI solo
      - En Play Store el usuario solo descarga la ABI de su dispositivo

.PARAMETER BuildType
    'debug' (defecto) o 'release'.

.PARAMETER Abi
    ABI objetivo:
      arm64     -> arm64-v8a (defecto, todos los Android modernos)
      arm32     -> armeabi-v7a (compatibilidad con hardware viejo)
      x86_64    -> emuladores AVD x86_64
      x86       -> emuladores AVD x86
      universal -> todas las ABIs (~216 MB, comportamiento previo)

.PARAMETER Bundle
    Genera un Android App Bundle (.aab) en vez de APK.
    Ideal para Play Store. Google split por ABI/densidad -> ~20 MB descarga.

.PARAMETER Minify
    Activa R8/ProGuard en builds release. Solo aplica con -BuildType release.
    Reduce ~40% el tamano del codigo Java/Kotlin.

.PARAMETER Clean
    Corre 'gradlew clean' antes de compilar.

.PARAMETER Install
    Instala el APK en el dispositivo conectado por ADB. No aplica con -Bundle.

.EXAMPLE
    # APK arm64 debug para tu celular (~55 MB) -- modo por defecto
    .\build-android.ps1

    # APK arm64 debug con clean previo
    .\build-android.ps1 -Clean

    # APK universal debug (igual que antes, ~216 MB)
    .\build-android.ps1 -Abi universal

    # APK arm64 release (~50 MB)
    .\build-android.ps1 -BuildType release

    # APK arm64 release con R8 (~28 MB)
    .\build-android.ps1 -BuildType release -Minify

    # AAB release para Play Store
    .\build-android.ps1 -BuildType release -Bundle -Minify -Clean

    # Compilar e instalar en el celular conectado por USB
    .\build-android.ps1 -Install
#>

[CmdletBinding()]
param(
    [ValidateSet('debug', 'release')]
    [string]$BuildType = 'debug',

    [ValidateSet('arm64', 'arm32', 'x86_64', 'x86', 'universal')]
    [string]$Abi = 'arm64',

    [switch]$Bundle,
    [switch]$Minify,
    [switch]$Clean,
    [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- Rutas ------------------------------------------------------------------
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot   = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$MobileDir  = Join-Path $RepoRoot "apps\mobile"
$AndroidDir = Join-Path $RepoRoot "apps\mobile\android"

# --- Java 17 ----------------------------------------------------------------
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:PATH      = "$env:JAVA_HOME\bin;$env:PATH"

$javaVer = try {
    (java -version 2>&1 | Select-Object -First 1) -as [string]
} catch {
    'no detectado'
}

# --- Mapa ABI ---------------------------------------------------------------
# Usa -PreactNativeArchitectures (propiedad nativa de RN, ya esta en gradle.properties)
$abiMap = @{
    arm64     = 'arm64-v8a'
    arm32     = 'armeabi-v7a'
    x86_64    = 'x86_64'
    x86       = 'x86'
    universal = 'armeabi-v7a,arm64-v8a,x86,x86_64'
}
$architectures = $abiMap[$Abi]

# --- Tarea Gradle -----------------------------------------------------------
$Variant    = $BuildType.Substring(0,1).ToUpper() + $BuildType.Substring(1)
$taskVerb   = if ($Bundle) { 'bundle' } else { 'assemble' }
$gradleTask = "app:$taskVerb$Variant"
$outputType = if ($Bundle) { 'AAB' } else { 'APK' }
$abiLabel   = if ($Abi -ne 'universal') { "$Abi ($($abiMap[$Abi]))" } else { 'universal (todas las ABIs)' }

Write-Host ""
Write-Host "==========================================="
Write-Host "  Impostor Futbol -- Android Build"
Write-Host "==========================================="
Write-Host "  Java    : $javaVer"
Write-Host "  Tipo    : $BuildType"
Write-Host "  ABI     : $abiLabel"
Write-Host "  Output  : $outputType"
if ($Minify) { Write-Host "  R8      : activado" }
Write-Host "  Task    : $gradleTask"
Write-Host "==========================================="
Write-Host ""

# --- Args de Gradle ---------------------------------------------------------
$gradleArgs = @(
    $gradleTask,
    '-x', 'lint',
    '-x', 'test',
    "-PreactNativeArchitectures=$architectures"
)

# Minify y ShrinkResources se manejan de forma nativa a traves de app.json (expo-build-properties)


# --- Clean ------------------------------------------------------------------
if ($Clean) {
    Write-Host "Limpiando build anterior..." -ForegroundColor Yellow
    Push-Location $AndroidDir
    & ".\gradlew.bat" clean
    $cleanExit = $LASTEXITCODE
    Pop-Location
    if ($cleanExit -ne 0) { throw "gradlew clean fallo (exit $cleanExit)" }
    Write-Host ""
}

# --- Compilar ---------------------------------------------------------------
Write-Host "Ejecutando: gradlew $($gradleArgs -join ' ')" -ForegroundColor Green
$t0 = Get-Date

Push-Location $AndroidDir
& ".\gradlew.bat" @gradleArgs
$buildExit = $LASTEXITCODE
Pop-Location

if ($buildExit -ne 0) { throw "Compilacion fallo (exit $buildExit)" }

$elapsed = [int](New-TimeSpan -Start $t0 -End (Get-Date)).TotalSeconds

# --- Ubicar artefacto -------------------------------------------------------
$outDir = if ($Bundle) {
    Join-Path $AndroidDir "app\build\outputs\bundle\$BuildType"
} else {
    Join-Path $AndroidDir "app\build\outputs\apk\$BuildType"
}
$ext      = if ($Bundle) { 'aab' } else { 'apk' }
$artifact = Get-ChildItem $outDir -Filter "*.$ext" -Recurse -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1

# --- Resultado --------------------------------------------------------------
Write-Host ""
Write-Host "==========================================="
Write-Host "  Compilacion exitosa! ($elapsed s)" -ForegroundColor Green
if ($artifact) {
    $sizeMb = [math]::Round($artifact.Length / 1MB, 1)
    Write-Host "  Archivo : $($artifact.Name)  ($sizeMb MB)"
    Write-Host "  Ruta    : $($artifact.FullName)"
}
Write-Host "==========================================="

# --- Instalar por ADB -------------------------------------------------------
if ($Install -and (-not $Bundle) -and $artifact) {
    Write-Host ""
    Write-Host "Instalando en dispositivo conectado (ADB)..." -ForegroundColor Yellow
    & adb install -r $artifact.FullName
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Instalado correctamente." -ForegroundColor Green
    } else {
        Write-Host "Error al instalar. Conecta un dispositivo con USB Debugging activado." -ForegroundColor Red
    }
}
