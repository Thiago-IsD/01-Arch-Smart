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
credenciais válidas de staging:

    mediana_ms=pendente

Quando as credenciais existirem, rodar o comando acima e substituir a linha
acima por:

    amostras_ms=<colar AMOSTRAS da saída>
    mediana_ms=<colar MEDIANA_MS da saída>

Cascata de rede observada por navegação, hoje:
`createClient()` → `getSession()` → `fetch /api/products` → render.
Duas queries em paralelo (`products` e `inbox-count`), cada uma repetindo a
resolução de sessão.
