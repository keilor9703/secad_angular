param(
  [string]$RepoRoot = "C:\Users\Dyck.lopez\source\repos\sisgeNg",
  [string]$FrontendProject = "policiadev-app",
  [switch]$SkipNpmCi
)

$ErrorActionPreference = "Stop"

Write-Host "== SISGE build (Windows) =="
Write-Host "RepoRoot: $RepoRoot"

$backendProject = Join-Path $RepoRoot "backend\oftic\oftic\Api.csproj"
$backendWorkdir = Split-Path $backendProject -Parent
$backendPublish = Join-Path $backendWorkdir "publish\api"
$apiTar = Join-Path $env:TEMP "api-release.tar.gz"

$frontendWorkdir = Join-Path $RepoRoot "frontend"
$frontendDist = Join-Path $frontendWorkdir "dist\$FrontendProject"
$webTar = Join-Path $env:TEMP "web-release.tar.gz"

if (-not (Test-Path $backendProject)) {
  throw "No se encontro Api.csproj en: $backendProject"
}
if (-not (Test-Path (Join-Path $frontendWorkdir "angular.json"))) {
  throw "No se encontro angular.json en: $frontendWorkdir"
}

Write-Host "`n[1/4] Publicando backend..."
Push-Location $backendWorkdir
dotnet publish $backendProject -c Release -o $backendPublish
Pop-Location

if (Test-Path $apiTar) { Remove-Item $apiTar -Force }
Write-Host "[2/4] Empaquetando backend en $apiTar ..."
tar -czf $apiTar -C $backendPublish .

Write-Host "`n[3/4] Construyendo frontend..."
Push-Location $frontendWorkdir
if (-not $SkipNpmCi) {
  npm ci
}
npx ng build $FrontendProject --configuration production
Pop-Location

if (-not (Test-Path $frontendDist)) {
  throw "No se encontro carpeta dist del frontend: $frontendDist"
}
if (Test-Path $webTar) { Remove-Item $webTar -Force }
Write-Host "[4/4] Empaquetando frontend en $webTar ..."
tar -czf $webTar -C $frontendDist .

Write-Host "`nArtefactos generados:"
Write-Host "  API: $apiTar"
Write-Host "  WEB: $webTar"
Write-Host "`nComandos de subida:"
Write-Host "  scp `"$apiTar`" usrcoest@srvsicoedesa:/tmp/"
Write-Host "  scp `"$webTar`" usrcoest@srvsicoedesa:/tmp/"

