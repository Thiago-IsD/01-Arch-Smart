# ---------------------------------------------------------------------------
# build-clipper.ps1
# Regenera os pacotes de download da extensao (Web Clipper) a partir da fonte.
#
# Fonte:  <repo>/extension/            (arquivos editados manualmente)
# Saida:  <repo>/ArchSmart-web/public/arch-smart-clipper.zip      (ENV = prod)
#         <repo>/ArchSmart-web/public/arch-smart-clipper-dev.zip  (ENV = dev)
#
# Gera SEMPRE os dois zips, forcando o valor de 'const ENV' em cada um,
# independente do que estiver no popup.js. Assim o zip de producao entregue
# pela pagina /web-clipper nunca sai apontando para localhost por engano, e
# voce tem o zip de dev pronto para testar localmente.
#
# Rode sempre que alterar qualquer arquivo em extension/ antes de commitar.
#
# Uso:  npm run build:clipper   (a partir de ArchSmart-web)
#   ou: powershell -ExecutionPolicy Bypass -File scripts/build-clipper.ps1
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

# Caminhos resolvidos a partir da localizacao do script (robusto ao cwd)
$repoRoot  = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$extDir    = Join-Path $repoRoot "extension"
$publicDir = Join-Path $repoRoot "ArchSmart-web\public"

# Arquivos estaticos (copiados sem alteracao) + popup.js (ENV reescrito)
$staticFiles = @("content.js", "manifest.json", "popup.css", "popup.html")
$popupFile   = "popup.js"

if (-not (Test-Path $extDir)) {
    throw "Pasta de fonte da extensao nao encontrada: $extDir"
}
foreach ($f in ($staticFiles + $popupFile)) {
    $p = Join-Path $extDir $f
    if (-not (Test-Path $p)) { throw "Arquivo esperado nao encontrado: $p" }
}

$popupRaw = Get-Content (Join-Path $extDir $popupFile) -Raw
if ($popupRaw -notmatch 'const ENV\s*=\s*"[a-z]+"') {
    throw "Nao foi possivel localizar a constante 'const ENV' em popup.js."
}

# Gera um zip para um ambiente especifico, reescrevendo o ENV do popup.js.
function Build-ClipperZip {
    param(
        [Parameter(Mandatory)] [string] $Env,
        [Parameter(Mandatory)] [string] $OutZip
    )

    # Pasta temporaria isolada para montar o conteudo do zip
    $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("clipper-" + $Env + "-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    try {
        # Copia os arquivos estaticos
        foreach ($f in $staticFiles) {
            Copy-Item (Join-Path $extDir $f) (Join-Path $stage $f) -Force
        }

        # popup.js com o ENV forcado para este ambiente
        $patched = [regex]::Replace($popupRaw, 'const ENV\s*=\s*"[a-z]+"', ('const ENV = "' + $Env + '"'))
        Set-Content -Path (Join-Path $stage $popupFile) -Value $patched -Encoding UTF8 -NoNewline

        if (Test-Path $OutZip) { Remove-Item $OutZip -Force }
        $items = Get-ChildItem -Path $stage -File | Select-Object -ExpandProperty FullName
        Compress-Archive -Path $items -DestinationPath $OutZip -Force

        $size = (Get-Item $OutZip).Length
        Write-Host ("OK [{0}]: {1} - {2} bytes" -f $Env, $OutZip, $size) -ForegroundColor Green
    }
    finally {
        Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Build-ClipperZip -Env "prod" -OutZip (Join-Path $publicDir "arch-smart-clipper.zip")
Build-ClipperZip -Env "dev"  -OutZip (Join-Path $publicDir "arch-smart-clipper-dev.zip")

Write-Host "Ambos os pacotes foram gerados (prod + dev)." -ForegroundColor Cyan
