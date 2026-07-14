# ---------------------------------------------------------------------------
# build-clipper.ps1
# Regenera o pacote de download da extensao (Web Clipper) a partir da fonte.
#
# Fonte:  <repo>/extension/            (arquivos editados manualmente)
# Saida:  <repo>/ArchSmart-web/public/arch-smart-clipper.zip
#
# Rode sempre que alterar qualquer arquivo em extension/ antes de commitar,
# senao o zip baixado pela pagina /web-clipper fica divergente da fonte.
#
# Uso:  npm run build:clipper   (a partir de ArchSmart-web)
#   ou: powershell -ExecutionPolicy Bypass -File scripts/build-clipper.ps1
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

# Caminhos resolvidos a partir da localizacao do script (robusto ao cwd)
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$extDir   = Join-Path $repoRoot "extension"
$outZip   = Join-Path $repoRoot "ArchSmart-web\public\arch-smart-clipper.zip"

$files = @("content.js", "manifest.json", "popup.css", "popup.html", "popup.js")

if (-not (Test-Path $extDir)) {
    throw "Pasta de fonte da extensao nao encontrada: $extDir"
}

$paths = New-Object System.Collections.Generic.List[string]
foreach ($f in $files) {
    $p = Join-Path $extDir $f
    if (-not (Test-Path $p)) { throw "Arquivo esperado nao encontrado: $p" }
    $paths.Add($p)
}

# Aviso caso o pacote esteja sendo gerado apontando para dev
$popup = Get-Content (Join-Path $extDir "popup.js") -Raw
$m = [regex]::Match($popup, 'const ENV\s*=\s*"([a-z]+)"')
if ($m.Success) {
    $clipperEnv = $m.Groups[1].Value
    Write-Host "Ambiente da extensao (ENV): $clipperEnv" -ForegroundColor Cyan
    if ($clipperEnv -ne "prod") {
        Write-Warning "ENV nao esta em prod. Ajuste 'const ENV' em extension/popup.js antes de publicar."
    }
}
else {
    Write-Warning "Nao foi possivel detectar a constante ENV em popup.js."
}

# Regenera o zip (arquivos na raiz, sem subpasta)
if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path $paths.ToArray() -DestinationPath $outZip -Force

$size = (Get-Item $outZip).Length
Write-Host "OK: zip gerado em $outZip - $size bytes" -ForegroundColor Green
