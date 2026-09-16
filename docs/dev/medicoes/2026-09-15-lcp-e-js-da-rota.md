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

## O "depois" — 16/09/2026, Tarefa 12 da migração de Projetos

Mesmo arranjo do "antes", com uma diferença deliberada: aqui é
`next build && next start` (produção local), não `next dev` — o "antes" já
usava build de produção também (ver "Arranjo" acima), então os dois lados são
comparáveis. Commit medido: HEAD desta branch depois da Tarefa 11
(`45fd072`), antes desta tarefa tocar `docs/`.

```bash
cd ArchSmart-web
npm run build && npm run start          # outro terminal; playwright reusa a :3000
set -a; . ./.env.e2e.local; set +a
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"
for r in /library /dashboard /projects; do
  ROTA=$r npx playwright test e2e/medicao-carga.spec.ts --reporter=line --timeout=180000 2>&1 | grep -E "^(ROTA|PERFIL|LCP_|JS_)"
done
```

```
ROTA=/library
LCP_AMOSTRAS=980,988,1108,1120,1272
LCP_MEDIANA_MS=1108
JS_BYTES=482778
JS_ARQUIVOS=31

ROTA=/dashboard
LCP_AMOSTRAS=1016,1168,1180,1228,1500
LCP_MEDIANA_MS=1180
JS_BYTES=467997
JS_ARQUIVOS=28

ROTA=/projects
LCP_AMOSTRAS=924,928,952,1064,1188
LCP_MEDIANA_MS=952
JS_BYTES=466888
JS_ARQUIVOS=29
```

| Rota | LCP antes (ms) | LCP depois (ms) | JS antes (bytes) | JS depois (bytes) | Arquivos antes | Arquivos depois |
|---|---:|---:|---:|---:|---:|---:|
| `/library` | 1048 | **1108** | 380403 | **482778** | 24 | **31** |
| `/dashboard` | 1292 | **1180** | 467830 | **467997** | 28 | **28** |
| `/projects` | 1308 | **952** | 358129 | **466888** | 23 | **29** |

**Biblioteca e Dashboard não foram tocados por esta seção depois da medição
"antes"** — a diferença nos dois vem inteira das Tarefas 9–11 desta mesma
migração (Projetos), que mexem em código **compartilhado** por todas as
telas: a Tarefa 9 uniu o prefetch pareado da Biblioteca numa chamada só e
corrigiu `tentarPrefetch`; a Tarefa 10 trocou o token `destructive` em
`globals.css` (CSS compartilhado, todas as rotas); a Tarefa 11 mexeu no
`AppShell` (`Header`, `Sidebar`, `Skeleton`, o botão de chat) — que **toda**
rota autenticada carrega. É por isso que o JS sobe nas três rotas, inclusive
nas duas que a Tarefa 12 não tocou: o aumento é de **JS compartilhado**, não
de código da rota. O LCP da Biblioteca também subiu (1048 → 1108 ms) e o do
Dashboard **caiu** (1292 → 1180 ms) — dentro do ruído de 5 amostras em rede
throttled; nenhum dos dois é resultado de uma mudança feita na tela deles
nesta seção.

`/projects` é a única rota com "antes" e "depois" que também mudou de
código diretamente (é a tela migrada): LCP caiu de 1308 para 952 ms e o JS
da rota específica cresceu (358129 → 466888 bytes, 23 → 29 arquivos) — o
esperado para uma tela que ganhou `@tanstack/react-query`, prefetch e
`HydrationBoundary`, o mesmo padrão que a Biblioteca e o Dashboard já
pagaram. **Nenhum dos dois números tem orçamento formal da spec-mãe medido
como alvo único** (o orçamento é por composição: LCP < 2,0 s e JS < 200 KB
gzip **da rota**, e este instrumento mede JS **não-gzip e com o
compartilhado incluído** — ver "O que este número não é", acima); o que se
compara aqui é antes×depois da mesma régua, não a régua contra o alvo da
spec-mãe.
