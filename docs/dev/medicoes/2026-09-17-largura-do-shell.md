# A largura do shell depois do `min-w-0` — o que "estouro zero" quer dizer, 17/09/2026

Branch `secao-8-limpeza-projetos`, rodada 2 da limpeza de Projetos. A revisão
apontou um problema de significado, não de número: a branch acrescentou
`min-w-0` à coluna principal do shell (`ArchSmart-web/src/components/layout/AppShell.tsx:89`),
e com isso o estouro horizontal do **documento** foi a zero em quatro rotas
(`/library`, `/projects`, `/projects/<id>`, `/dashboard`). Mas `main` já era
`overflow-auto` (`AppShell.tsx:97`) antes dessa mudança. Sem `min-w-0`, a
coluna crescia até o conteúdo e o excesso virava rolagem do **documento**
(`documentElement.scrollWidth − innerWidth`, a métrica que já existia). Com
`min-w-0`, a coluna para de crescer e o mesmo excesso passa a virar rolagem
**dentro de `main`** — invisível para essa métrica. "Estouro do documento
zero" podia então significar "coube" **ou** "passou a rolar por dentro", e
nada no repositório media a segunda hipótese. A medição que provou a correção
original saiu de arquivos temporários já apagados.

## O instrumento

`ArchSmart-web/e2e/medicao-largura.spec.ts` — instrumento, não guarda (não
entra em `.github/workflows/e2e.yml`). Molde de `medicao-carga.spec.ts` e
`medicao-axe.spec.ts`: login real pela UI, parametrizado por `ROTA`,
`LARGURA` (px) e `TEMA` (`claro`/`escuro`, padrão `claro`) via variável de
ambiente, falha alto (nunca `skip`) quando falta `ROTA`, `E2E_EMAIL` ou
`E2E_PASSWORD`. Por rota, mede e imprime:

- `document.documentElement.scrollWidth`, `window.innerWidth` e a diferença
  (`DOCUMENTO_DIFF`) — a métrica antiga, a do estouro do documento;
- `scrollWidth`/`clientWidth` do **primeiro** `<main>` do documento em ordem
  (`MAIN_DIFF`) — o `<main>` do `AppShell`, mesmo em rotas que aninham um
  `<main>` próprio mais fundo (`budget`, por `ActiveBudgetWorkspace.tsx:96`),
  porque esse `<main>` interno vem depois no `querySelector`;
- quando `MAIN_DIFF > 0`, o elemento de maior `scrollWidth`/
  `getBoundingClientRect().width` entre **todos os descendentes** de `main`
  (não só os filhos diretos — o nó que estoura pode estar mais fundo, e um
  estouro raso não aponta a causa), com um seletor (tag + id + `data-testid` +
  até 3 classes) que identifica o nó.

### Comando

```
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
ROTA=/library LARGURA=390 TEMA=claro npx playwright test e2e/medicao-largura.spec.ts --reporter=line
```

(No Git Bash do Windows, `ROTA=/library` sem `MSYS_NO_PATHCONV=1` é reescrito
para um caminho de arquivo local pelo MSYS antes de chegar ao Node — o
sintoma é `net::ERR_FILE_NOT_FOUND at c:/Program Files/Git/library`. Rodando
de outro shell isso não acontece; documentado aqui porque não é óbvio.)

### Controle: o instrumento detecta estouro quando ele existe

Antes de confiar nos zeros abaixo, uma verificação de que o instrumento não
está cego: `/finance` a **200px** (largura fora do escopo desta medição, só
para forçar overflow):

```
ROTA=/finance LARGURA=200 TEMA=claro npx playwright test e2e/medicao-largura.spec.ts --reporter=line
```

```
DOCUMENTO_SCROLL_WIDTH=200 INNER_WIDTH=200 DOCUMENTO_DIFF=0
MAIN_SCROLL_WIDTH=258 MAIN_CLIENT_WIDTH=200 MAIN_DIFF=58
MAIN_ELEMENTO_MAIS_LARGO=div.relative.w-full.overflow-auto scrollWidth=659 rectWidth=150
```

Confirma duas coisas: o instrumento enxerga estouro **dentro** de `main` sem
nenhum estouro no documento (exatamente a situação que a revisão temia que
pudesse existir sem ninguém notar), e aponta o elemento causador. Os zeros
medidos abaixo, em 390px e 1440px, não são um instrumento que nunca acusa
nada.

## Arranjo

- Front: `npm run dev`, worktree isolado desta tarefa, branch
  `secao-8-limpeza-projetos`, commit `413c8f8` (ponta no momento da medição).
- API: `uvicorn app.main:app --port 8000` local (venv reaproveitado do
  checkout principal via junction — este worktree não tinha `venv/` nem
  `.env`, nenhum dos dois versionado), apontada para o **banco de staging**
  (`ArchSmart-api/.env`, bloco `## staging ##` ativo, produção comentada —
  conferido antes de rodar). Nada foi escrito no banco além do que login e
  navegação normal já escrevem.
- Front local: `NEXT_PUBLIC_API_URL=http://localhost:8000` (`.env.local`
  copiado do checkout principal, mesmo motivo — gitignored, não versionado).
- Conta: usuário de teste E2E (`ana.arquiteta@seed.arqsmart.local`), senha em
  `ArchSmart-web/.env.e2e.local` (idem, copiado do checkout principal).
- Navegador: Chromium do Playwright, headless, via `page.setViewportSize`.
- Tema: só **claro** — nenhuma rota divergiu entre as duas métricas, então não
  houve motivo para medir o escuro também (a tarefa só pedia o escuro "se algo
  divergir").
- Projeto usado nas rotas de `/projects/<id>`: **"Loft Pinheiros #3"**
  (`beaf469e-2b4f-4e47-b2e3-0ef6f7a5b7ee`), o mesmo já citado em `../../PROGRESS.md`
  no achado do estouro de 203px da Seção 8 — nome de projeto longo, 6
  ambientes, escolhido por ser o caso que já tinha estourado antes.
  Identificado logando via API do Supabase (`/auth/v1/token?grant_type=password`)
  e listando `GET /api/projects` com o token; não há id de projeto ou de conta
  literal em código nenhum deste repositório, só nesta nota de medição.

## A tabela

Todas as 16 combinações abaixo foram medidas; nenhuma estimada.

| Rota | Largura | `DOCUMENTO_DIFF` | `MAIN_DIFF` | Veredicto |
|---|---:|---:|---:|---|
| `/library` | 390px | 0 | 0 | cabe |
| `/library` | 1440px | 0 | 0 | cabe |
| `/projects` | 390px | 0 | 0 | cabe |
| `/projects` | 1440px | 0 | 0 | cabe |
| `/dashboard` | 390px | 0 | 0 | cabe |
| `/dashboard` | 1440px | 0 | 0 | cabe |
| `/projects/<id>` (Loft Pinheiros #3) | 390px | 0 | 0 | cabe |
| `/projects/<id>` | 1440px | 0 | 0 | cabe |
| `/projects/<id>/print` | 390px | 0 | 0 | cabe |
| `/projects/<id>/print` | 1440px | 0 | 0 | cabe |
| `/projects/<id>/budget` | 390px | 0 | 0 | cabe |
| `/projects/<id>/budget` | 1440px | 0 | 0 | cabe |
| `/presentations` | 390px | 0 | 0 | cabe |
| `/presentations` | 1440px | 0 | 0 | cabe |
| `/finance` | 390px | 0 | 0 | cabe |
| `/finance` | 1440px | 0 | 0 | cabe |

`MAIN_SCROLL_WIDTH`/`MAIN_CLIENT_WIDTH` brutos, para quem quiser conferir a
aritmética: em 390px os dois valem 390 em toda rota (a `Sidebar` desktop
está escondida abaixo de `lg`, então `main` ocupa a largura inteira); em
1440px os dois valem 1184 em toda rota (1440 − 256 da `Sidebar` fixa). Como
`MAIN_DIFF` é sempre 0, `MAIN_SCROLL_WIDTH == MAIN_CLIENT_WIDTH` nas 16
linhas — não há elemento mais largo para reportar em nenhuma (o campo
`MAIN_ELEMENTO_MAIS_LARGO` saiu `n/a` nas 16).

## A resposta à pergunta da revisão

**Em nenhuma das 8 rotas medidas — nem as 4 já migradas, nem as 4 telas de
padrão antigo da amostra — o conteúdo passou a rolar por dentro de `main`.**
`main.scrollWidth == main.clientWidth` nas 16 combinações. O "estouro do
documento zero" que a Seção 8/Projetos tinha medido não escondia rolagem
interna: o conteúdo **cabe** de verdade, nas duas larguras, nas oito rotas.

Isso inclui a rota de impressão: **`/projects/<id>/print` não rola por
dentro em nenhuma das duas larguras** — `MAIN_DIFF=0` em 390px e em 1440px.
É a rota que mais importa (destino é papel, onde rolagem invisível na tela
seria a pior surpresa possível, porque na impressão real não haveria como
"rolar" para ver o que ficou cortado), e ela não apresenta o problema.

Isto **não prova que `min-w-0` nunca causa rolagem interna em rota nenhuma
da aplicação** — prova que não causa nas 8 rotas amostradas, nas 2 larguras
medidas, no tema claro, com os dados desta conta de teste. Ver a seção
seguinte.

## O que este número não é

- **Não é uma prova para as ~28 rotas não migradas inteiras.** A tarefa pediu
  uma amostra (`print`, `budget`, `presentations`, `finance`) exatamente
  porque medir todas está fora do escopo desta rodada; as rotas não
  amostradas (`calendar`, `settings`, `billing`, `profile`, os detalhes de
  apresentação/builder, etc.) não foram tocadas por este instrumento.
- **Não é medida de conteúdo variável.** A conta de teste tem 5 projetos, um
  deles com 6 ambientes e nome de 19 caracteres; uma tabela financeira com
  muito mais linhas, ou um nome de projeto muito mais longo, pode se
  comportar diferente. O instrumento mede o que está na tela no momento em
  que roda, não o pior caso.
- **Não é medida do tema escuro.** Só o claro foi medido, pela regra "escuro
  só se algo divergir" — nada divergiu no claro, então o escuro não foi
  medido. Isso é "não medido", não "também passa".
- **Não é medida de nenhuma largura entre 390px e 1440px**, nem abaixo de
  390px nem acima de 1440px. O controle a 200px (acima) mostra que existe
  largura onde `/finance` estoura por dentro — só que fora do intervalo que
  esta tarefa pediu para medir.
- **Não é axe, teclado, nem contraste.** É só as duas métricas de largura
  descritas acima.
- **Não é garantia permanente.** É um instrumento versionado, não uma guarda
  de CI — ele não impede alguém de remover o `min-w-0` amanhã e ficar verde
  em tudo o que já existia antes desta rodada. Rodá-lo de novo depois de
  qualquer mudança no shell ou em `main` é responsabilidade de quem mudar.
