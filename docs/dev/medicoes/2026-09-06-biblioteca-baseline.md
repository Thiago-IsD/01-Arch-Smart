# Baseline da Biblioteca — antes da Seção 5

Medido em 06/09/2026, na branch `secao-5-camada-de-dados-frontend`, no commit
imediatamente anterior à Tarefa 2.

Comando:

    cd ArchSmart-web
    npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line

## Leitura pendente de credenciais

O spec exige sessão real: ele faz login pela UI lendo `E2E_EMAIL` e
`E2E_PASSWORD` do ambiente antes de medir (`ArchSmart-web/e2e/medicao-biblioteca.spec.ts`).
Nenhuma das duas variáveis está definida neste ambiente — confirmado com
`env | grep -i E2E_` (saída vazia) e por não haver `E2E_EMAIL`/`E2E_PASSWORD`
documentadas em nenhum `.env*` do repositório
(`grep -rln "E2E_EMAIL\|E2E_PASSWORD" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.env*" .`
não encontra nenhuma credencial, só este próprio arquivo de medição e a
esteira de progresso).

O instrumento foi validado sem credenciais: rodando o comando acima com
`E2E_EMAIL`/`E2E_PASSWORD` ausentes, o spec falha imediatamente, antes de
navegar para qualquer página, com a mensagem

    Error: E2E_EMAIL e/ou E2E_PASSWORD não estão definidos no ambiente. Defina
    as duas variáveis com credenciais de um usuário real antes de rodar esta
    medição, ex.: E2E_EMAIL=... E2E_PASSWORD=... npx playwright test
    e2e/medicao-biblioteca.spec.ts

— reportado como `1 failed`, nunca como `skipped`, e sem imprimir `AMOSTRAS`
ou `MEDIANA_MS`. Isso confirma que o instrumento não inventa número quando
não pode medir.

**A leitura real (API quente, sessão de um usuário de verdade) continua
pendente** até que `E2E_EMAIL` e `E2E_PASSWORD` sejam configuradas com
credenciais válidas de staging. **Este é o valor vigente hoje** — a única
outra ocorrência de `mediana_ms=` neste arquivo, logo abaixo, é o molde a
preencher quando a medição real existir, não um segundo valor:

    mediana_ms=pendente  # PENDENTE — ainda não medido, ver Tarefa 12

Quando as credenciais existirem, rodar o comando acima e substituir a linha
`mediana_ms=pendente` logo acima (não esta) por:

    amostras_ms=<colar AMOSTRAS da saída>
    mediana_ms=<colar MEDIANA_MS da saída>

Cascata de rede observada por navegação, hoje:
`createClient()` → `getSession()` → `fetch /api/products` → render.
Duas queries em paralelo (`products` e `inbox-count`), cada uma repetindo a
resolução de sessão.

## Atualização de 10/09/2026 (Tarefa 1 da Seção 6) — este baseline permanece não medido, por construção

O usuário de teste E2E foi criado nesta tarefa (ver
[`2026-09-09-usuario-de-teste-e2e.md`](2026-09-09-usuario-de-teste-e2e.md)), e
a leitura real do **"depois"** foi feita — ver
[`2026-09-06-biblioteca-depois.md`](2026-09-06-biblioteca-depois.md), seção
"✅ PORTÃO FECHADO". Mas o **"antes"** deste arquivo não pôde ser medido nem
agora: o código de antes da Seção 5 (a versão de `LibraryContent` com três
`useQuery` e `fetch` cru descrita acima) não existe mais em nenhuma branch
viva — foi substituído pelo desenho atual no merge da Seção 5
(`6e94d63`/`ce1012e`). Medir o "antes" exigiria fazer checkout do commit
anterior à Seção 5, uma árvore de trabalho separada, `npm install` e um
segundo servidor — fora do escopo desta tarefa (Tarefa 1 da Seção 6), que é
fechar a medição do "depois", não reconstruir o "antes".

`mediana_ms=pendente` continua sendo o valor vigente **para este arquivo**.
A linha permanece assim de propósito — não substitua por um número: nenhuma
medição de "antes" foi feita, nesta tarefa ou em qualquer outra, na branch
atual. A comparação que existe é contra a referência de agosto de 2026 da
spec (`3,6 s` para a Biblioteca,
`docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md:37`),
rotulada como referência externa, não como baseline medido neste
repositório — ver o detalhe em `2026-09-06-biblioteca-depois.md`.
