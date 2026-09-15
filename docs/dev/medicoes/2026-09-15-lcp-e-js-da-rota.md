# LCP e JS da rota — /library, /dashboard e /projects, 15/09/2026

Tarefa 1 da migração de Projetos (Seção 8). Instrumento novo
(`ArchSmart-web/e2e/medicao-carga.spec.ts`), não guarda — não entra em
`e2e.yml`. Produz o número "antes" de Projetos e, de propósito, também mede
Biblioteca e Dashboard: nenhuma das duas tinha esses dois números até agora.

## O perfil

"4G" é o perfil "Slow 4G" do Lighthouse, aplicado por CDP: RTT 150 ms,
1,6 Mbps de descida, 750 Kbps de subida, CPU 4x mais lenta. **Não é rede 4G
real** — é throttling do Chromium, e todo número abaixo carrega esse rótulo.

JS é a soma de `encodedBodySize` (bytes pela rede, já comprimidos) dos
recursos `.js` da carga dura, com cache desabilitado — JS compartilhado **e**
da rota, não só da rota. Só vale contra `next build && next start`: em
`next dev` o JS não é minificado e o número não diz nada.

## Arranjo

- Commit medido: `139b16b` (`git rev-parse --short HEAD`).
- Front: `next build && next start` (produção local), porta `:3000`.
- API: `uvicorn app.main:app --port 8000` local, apontada para o **banco de
  staging** — o arranjo normal das medições desta seção. Nenhum script de
  escrita foi rodado; a única escrita no banco é a que login e telemetria já
  fazem sozinhos.
- Conta: usuário de teste E2E, credenciais em `ArchSmart-web/.env.e2e.local`
  (não versionado).
- Navegador: Chromium do Playwright, 5 repetições por rota, a primeira usada
  só para aquecer a API antes de aplicar o throttling.

Comando (Step 4 do brief), rodado uma vez por rota — nenhuma precisou de
segunda tentativa:

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
for r in /library /dashboard /projects; do
  ROTA=$r npx playwright test e2e/medicao-carga.spec.ts --reporter=line --timeout=180000 2>&1 | grep -E "^(ROTA|PERFIL|LCP_|JS_)"
done
```

> Nota de execução, fora do brief: em Git Bash, `ROTA=/library` (e as outras
> duas) chegava ao processo Node como `c:/Program Files/Git/library` — a
> conversão de path do MSYS reescrevendo um argumento que só parece caminho
> Unix. A correção foi exportar `MSYS_NO_PATHCONV=1` e
> `MSYS2_ARG_CONV_EXCL=*` antes do laço; não muda o instrumento, só o
> ambiente de shell que o invoca.

## Resultado — saída colada do Step 4

```
ROTA=/library
PERFIL=slow4g-cdp rtt=150ms down=1.6Mbps up=750Kbps cpu=4x
LCP_AMOSTRAS=932,1036,1048,1692,1780
LCP_MEDIANA_MS=1048
JS_BYTES=380403
JS_ARQUIVOS=24

ROTA=/dashboard
PERFIL=slow4g-cdp rtt=150ms down=1.6Mbps up=750Kbps cpu=4x
LCP_AMOSTRAS=928,940,1292,1456,2424
LCP_MEDIANA_MS=1292
JS_BYTES=467830
JS_ARQUIVOS=28

ROTA=/projects
PERFIL=slow4g-cdp rtt=150ms down=1.6Mbps up=750Kbps cpu=4x
LCP_AMOSTRAS=1172,1304,1308,1504,1544
LCP_MEDIANA_MS=1308
JS_BYTES=358129
JS_ARQUIVOS=23
```

| Rota | LCP mediana (ms) | Amostras | JS (bytes, rede) | Arquivos JS | Momento |
|---|---:|---|---:|---:|---|
| /library | 1048 | 932,1036,1048,1692,1780 | 380403 | 24 | antes da migração de Projetos |
| /dashboard | 1292 | 928,940,1292,1456,2424 | 467830 | 28 | antes da migração de Projetos |
| /projects | 1308 | 1172,1304,1308,1504,1544 | 358129 | 23 | **antes** |

## O que este número não é

- **Não é 4G real** — é throttling do Chromium via CDP (perfil "Slow 4G" do
  Lighthouse), rodando na máquina de desenvolvimento.
- **O JS inclui o compartilhado**, não só o da rota — não dá para subtrair um
  do outro sem medir o compartilhado à parte, o que este instrumento não faz.
- **O LCP é de rota autenticada com API local** (apontada para o banco de
  staging), não a API implantada em staging/produção — a latência de rede até
  a API implantada não entra nesta amostra.
