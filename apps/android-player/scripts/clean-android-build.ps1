# Stops Gradle daemons and removes module build outputs (fixes Windows file-lock build failures).
# Close Android Studio first if deletion still fails.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Set-Location $ProjectRoot
Write-Host "Project: $ProjectRoot"

$gradlew = Join-Path $ProjectRoot "gradlew.bat"
if (Test-Path $gradlew) {
    Write-Host "Stopping Gradle daemons..."
    & $gradlew --stop 2>&1 | Out-Host
}

$buildDirs = @(
    "app\build",
    "feature\player\build",
    "feature\sync\build",
    "feature\pairing\build",
    "core\domain\build",
    "core\database\build",
    "core\network\build",
    "core\media\build",
    "build",
    ".gradle\buildOutputCleanup"
)

foreach ($rel in $buildDirs) {
    $path = Join-Path $ProjectRoot $rel
    if (Test-Path $path) {
        Write-Host "Removing $rel ..."
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}

Write-Host "Done. Rebuild from Android Studio (Build > Rebuild Project) or: .\gradlew.bat :app:assembleDebug"
