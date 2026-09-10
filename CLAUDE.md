# Arq Smart — regras do repositório

## Onde estamos

A plataforma está em **reestruturação de nove seções**. Este arquivo descreve o **alvo**, e nem tudo dele existe ainda.

Antes de escrever qualquer código:

1. Leia `PROGRESS.md` — o que já foi feito e o que continua no padrão antigo.
2. Leia `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` — o plano das nove seções.

**Código em área ainda não migrada segue o padrão antigo até a tarefa dela chegar.** Nunca migre uma área "de passagem": isso mistura mudanças, quebra a medição de desempenho e torna impossível saber o que causou uma regressão.

Estado em 10/09/2026: Seção 1 concluída (correções de segurança, merge `f190a07`). Seção 2 concluída (estrutura e documentação, merge `f167375`). Seção 3 concluída (esteira, ambientes e branches, 5/5). **Seção 4 concluída, mergeada e implantada em staging** — camada de dados do backend, 9/9, merge `f963fb6` em `develop` e PR #5 `develop` → `staging`. **Seção 5 concluída e mergeada até `staging`** — camada de dados do frontend, 8/8, merge `6e94d63` em `develop` e PR #6 `develop` → `staging` (merge `ce1012e`, 07/09/2026), com os três jobs de CI verdes. **O portão de tempo daquela seção estava ABERTO e foi FECHADO em 10/09/2026**, na Tarefa 1 da Seção 6: o que faltava era credencial de usuário de teste, e a tarefa criou o usuário dedicado em staging e rodou o Playwright — mediana de **1454 ms** (`AMOSTRAS=1434,1445,1454,1469,1948`), mais a verificação viva de que a lista da Biblioteca hidrata sem requisição do navegador. O "antes" continua **não medido** — o código anterior à Seção 5 não existe em nenhuma branch viva —, então a comparação é contra a referência externa de agosto (3,6 s), rotulada como tal; ver a nota da Seção 5 em `PROGRESS.md` e [`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`](docs/dev/medicoes/2026-09-06-biblioteca-depois.md). **Seção 6 concluída e mergeada até `staging`** — camada de UI, 9/9, merge `0ac71d9` em `develop` e PR #7 `develop` → `staging` (merge `5dbd13f`, 10/09/2026). O que ela entregou está em [`docs/dev/componentes.md`](docs/dev/componentes.md), que é a referência a ler **antes** de construir tela nova. Como na Seção 5, "mergeada até staging" não quer dizer verificada de fora: a Deployment Protection da Vercel continua escondendo o conteúdo, e **ninguém abriu as telas para confirmar que o build servido é o da Seção 6**. Seções 7 a 9 pendentes; **a próxima é a Seção 7** (telemetria). Produção ainda não recebeu: `main` está na Seção 3.

> Sobre "implantada em staging" na Seção 5, e a diferença para a Seção 4: no caso do backend deu para medir o contêiner servindo o código novo. Aqui não. O frontend de staging responde `302` para `vercel.com/sso-api` (medido em 08/09/2026), o que prova que **o deployment existe** — em contraste com `DEPLOYMENT_NOT_FOUND` —, mas a Deployment Protection esconde o conteúdo, então **ninguém verificou de fora que o build servido é o da Seção 5**. A API de staging não foi tocada por esta seção (`/health` → `200`, com 41,4 s de cold start na primeira chamada, o mesmo fenômeno da [ADR 0009](docs/dev/decisoes/0009-prefetch-dentro-de-suspense.md)).

Os ambientes online existem e estão medidos:

| Ambiente | API (Render) | Banco (Supabase) |
|---|---|---|
| staging | `https://arqsmart-staging.onrender.com` | `ipbhtqzybgdltewwnvnl`, Postgres 17.6 |
| produção | `https://arqsmart-prod.onrender.com` | `wokgnojyrpzndtxzvfcz`, Postgres 17.6 |

Frontend em `https://www.arqsmart.com.br` (Vercel, projeto `arqsmart`), com preview automático por branch. Os dois bancos nasceram da receita de migrações, sem passo manual — mas repositório e ambientes implantados não estão no mesmo lugar hoje, e vale medir os dois separado em vez de repetir um só número: **no repositório**, `alembic heads` aponta para `9b0c34de353b`, 30 migrações (`ls ArchSmart-api/alembic/versions/*.py | wc -l`); **nos bancos online os dois ambientes já não estão no mesmo lugar**: `staging` recebeu o merge da Seção 4 em 06/09/2026 e o contêiner subiu servindo o código novo (medido: `/health` → `{"status":"ok"}`, `/health/db` → `{"status":"ok","db":"up"}`, `/` → `{"message":"API Arq Smart"}`), e pela [ADR 0007](docs/dev/decisoes/0007-migracao-no-start-do-container.md) o uvicorn só sobe se a receita passou — então o schema de staging está no head que a branch levou. **produção** continua em `b77a9b5656c2`, 27 tabelas, porque `main` ainda não recebeu o merge. Não repita `9b0c34de353b` como se estivesse nos dois, nem `b77a9b5656c2` como se fosse o head do repositório — confira de qual dos três lugares a pergunta é antes de responder, e para o número exato de um ambiente rode `alembic current` com a `DATABASE_URL` dele em vez de deduzir.

Quatro coisas que economizam tempo antes de mexer em ambiente:

- **A migração roda no `CMD` do `Dockerfile`**, antes do uvicorn e ligada por `&&` ([ADR 0007](docs/dev/decisoes/0007-migracao-no-start-do-container.md)). O Render free tier não tem Pre-Deploy Command. Migração vermelha derruba o deploy — é de propósito. **Nunca rode `alembic upgrade head` à mão** contra staging ou produção.
- **`DATABASE_URL` usa o host pooler na porta 5432**, nunca a 6543 (estado de sessão vaza entre clientes e já derrubou um deploy) nem `db.<ref>.supabase.co` (IPv6-only, não resolve em rede sem IPv6). O caso completo está em [ambientes-online.md](docs/dev/ambientes-online.md), seção 1, item 6.
- **`develop` é local.** O `ArchSmart-api/.env` tem staging e produção separados, com produção comentada — confira para qual banco ele aponta **antes** de rodar qualquer script.
- **Endpoint não fala com o banco direto.** Toda leitura e escrita passa por
  `ScopedRepository` (`app/db/repository.py`), que filtra por `account_id`
  sozinho. As 29 chamadas de `db.query(` que restam em `app/` têm razão
  documentada — portal público, catálogo global, ou código que roda antes de
  existir sessão; ver a nota da Seção 4 em `PROGRESS.md` para a contagem
  completa. `tests/test_arquitetura.py::test_query_direta_so_em_model_sem_account_id`
  reprova um `db.query()` que volte a um arquivo já convertido.

O `docker-compose.test.yml` e o CI foram alinhados para Postgres 17 em 05/09/2026, na Tarefa 1 da Seção 4 — a divergência com os 17.6 de staging e produção era o risco de uma migração passar no CI e derrubar o contêiner no deploy (ADR 0007).

## O que a Seção 4 deixou em aberto

Nenhuma destas é para um agente decidir sozinho. Continuam abertas depois da Seção 5 — as de backend (2, 4, 5, 6) esperam a seção que voltar a mexer na API.

1. **Branch protection ligada ou não** — virou possível quando o repositório foi tornado público em 30/08. Anterior à Seção 4; roteiro em [ambientes-online.md](docs/dev/ambientes-online.md), seção 5.
2. **O auto-link por e-mail sobrevive em `POST /api/auth/complete-register`.** A Seção 4 removeu esse padrão do resolvedor de identidade — que cobre toda requisição autenticada —, mas o caminho legado continua resolvendo usuário por e-mail e gravando o `supabase_id` do portador. **O efeito não é vincular: é tomada de conta completa**, porque a partir dali o resolvedor entrega a conta da vítima ao token do atacante. É alcançável por dois fluxos vivos do front (`auth/verify` e `auth/reset-password`), e a única proteção é a opção *Confirm email* do painel do Supabase — fora do controle de versão, e nada neste repositório consegue testá-la. Detalhe em [arquitetura.md](docs/dev/arquitetura.md), seção "Resolvido em 05/09/2026".
3. ~~`ValidacaoDeDominio` responde 422 também para falha de infraestrutura.~~ **Decidido em 06/09/2026, na Seção 5.** Dez rotas mudaram de status na Seção 4 (400→422 e 500→422); a tabela com arquivo, função e o antes/depois está na nota da Seção 4 no `PROGRESS.md`. A pergunta em aberto era como o cliente trataria os dois formatos de 422 que convivem na API (lista do Pydantic, string de domínio) sem ramificar por status — a decisão que ficou de pé: **o cliente do frontend discrimina pelo formato de `detail`, nunca pelo status HTTP** (`ArchSmart-web/src/lib/api/errors.ts`). `detail` string é sentença de domínio, exibida direto; `detail` array é erro de schema, vira mensagem genérica mais log. O status em si — se 422 é o código certo para falha de infraestrutura — continua sem revisão; o que se fechou foi só o contrato que o cliente lê.
4. **Quatro migrações antigas têm `downgrade()` não vazio que estoura em execução** (`op.drop_constraint(None, ...)` sem `naming_convention` em `app/db/base.py`). A regra da casa é "todo `downgrade()` não vazio" — o que se descobriu é que "não vazio" nunca significou "funciona". Medir com `grep -rn "drop_constraint(None" ArchSmart-api/alembic/versions/*.py`.
5. **`app/services/`, `app/core/` e `app/db/` não têm catraca estática.** O lint de query direta cobre `app/api/` e `financial_service.py`; uma query sem escopo escrita fora daí não é reprovada por nada.
6. **18 rotas recebem ids no corpo** e não são alcançadas pelo teste genérico de isolamento, que percorre rotas com id na URL. `PATCH /api/products/batch-approve` é uma delas.

## O que a Seção 5 deixou em aberto — **as duas fecharam na Seção 6**

Diferente da lista acima: isto não era "esbarrar se aparecer". A Seção 6 devia
começar planejando as duas, pondo cada uma como tarefa ou registrando por
escrito a decisão de não pôr — e **as duas foram fechadas**, cada uma no seu
commit próprio. Ficam aqui, riscadas, com o que fechou cada uma: o histórico
de uma pendência é o que impede que ela volte pelo mesmo caminho.

> A segunda pendência deste bloco — a marca sem o Q — **foi fechada em
> 09/09/2026**, no commit próprio `b4fae10`, antes de a Seção 6 começar, como
> este arquivo mandava. Está registrada abaixo como item 2, resolvido.

1. ~~O portão de validação da Seção 5 nunca foi fechado.~~ **Fechado em
   10/09/2026, na Tarefa 1 da Seção 6.** A decisão registrada mais abaixo
   (criar primeiro um usuário de teste dedicado) foi executada: o usuário
   existe em staging, o Playwright rodou, e o número existe — mediana de
   **1454 ms**. A verificação viva da hidratação rodou junto e passou. O texto
   original fica abaixo porque a **forma** dele continua valendo: a spec exige
   provar o ganho antes de escalar — *"Só com o ganho confirmado ligam-se os
   lints e migra-se o resto"*. Enquanto a medição não tinha rodado, não havia
   "antes" nem "depois", nenhum número foi inventado, e o que existia no lugar
   era evidência **estrutural**, rotulada como tal em
   [`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`](docs/dev/medicoes/2026-09-06-biblioteca-depois.md).
   Fecha assim:

   ```
   cd ArchSmart-web
   E2E_EMAIL=<usuario> E2E_PASSWORD=<senha> npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
   ```

   O resultado vai nos dois arquivos de medição (`...-baseline.md` e
   `...-depois.md`). **A Seção 8 não deveria começar apoiada na Seção 5 até esse
   número existir** — e é a Seção 6 que decide se fecha o portão primeiro ou o
   carrega adiante assumindo o risco. Isso é decisão de Thiago, não de quem
   executa.

   **Decidido em 09/09/2026 por Thiago: criar primeiro um usuário de teste
   dedicado.** Não se mede com credencial de usuário real emprestada; o E2E
   precisa de uma conta própria em staging, com dados próprios. Isso virou a
   **Tarefa 1 da Seção 6**, executada em 10/09/2026 — ver
   [`docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md`](docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md).
   **A Seção 8 já pode se apoiar na Seção 5.**

   > A verificação viva da hidratação — abrir `/library` com a API quente e
   > confirmar que **nenhuma** requisição da lista sai do navegador no primeiro
   > carregamento — **rodou na mesma tarefa, e passou**. Ela existia porque "o
   > prefetch funciona" era inferência estrutural, não observação, e o modo de
   > falha dessa inferência é silencioso: o prefetch vira custo puro sem emitir
   > erro nenhum. A asserção discrimina por `state=NORMALIZED`, que é a chave
   > da lista; o badge do inbox continua fora do prefetch, pendência aberta da
   > Seção 5.

2. ~~A marca aparece sem o Q em 43 lugares, 27 arquivos.~~ **Corrigida em
   09/09/2026, no commit `b4fae10`** — commit próprio, mecânico, antes de a
   Seção 6 tocar essas telas, exatamente como este arquivo mandava. Eram 43
   ocorrências em 27 arquivos de copy que o usuário final lê (landing, login,
   cadastro, recuperação e reset de senha, preços, produto, sobre, web-clipper,
   beta, portal do cliente, `AppShell`, chat e o `title` do `layout.tsx`);
   viraram 43 de "Arq Smart", num diff de 43 inserções e 43 remoções. Confere
   com:

   ```
   grep -rn 'Arch Smart' ArchSmart-web/src --include=*.tsx --include=*.ts | wc -l   # 0
   ```

   As 2 ocorrências de `ArchSmart` **sem espaço** que restam em `src/` são
   referência a nome de diretório em comentário de doc, permitidas pelo Art. 8.
   `Ark Smart` e `Ecowe`: zero. O que a Seção 6 herda daqui é só a regra de não
   reintroduzir a grafia errada nas telas que ela vai reescrever.

## O que a Seção 6 deixou em aberto — **planejar no início da Seção 7**

Como o bloco anterior: **estas duas não são "esbarrar se aparecer". Quem
escrever o plano da Seção 7 põe cada uma como tarefa ou registra por escrito a
decisão de não pôr.** Nenhuma é para um agente decidir sozinho.

1. **Três mudanças visuais entraram e ninguém as viu.** Não há teste visual
   neste repositório: `tsc`, `vitest` e a catraca ficam verdes enquanto uma tela
   muda de aparência. A Seção 6 mudou três coisas de propósito, todas
   verificadas por CSS compilado e por diff — **nenhuma por olho humano**:

   | O quê | Onde aparece |
   |---|---|
   | `DropdownMenuItem` ganhou `min-h-11` (alvo de toque de 44px) | 34 itens em 6 telas: cabeçalho, card de produto, tabela financeira, card de ambiente, alternador de tema |
   | botão de fechar do toast destrutivo trocou `text-red-*` por token | todo toast de erro |
   | `Skeleton` ganhou `aria-hidden="true"` | todo estado de carregamento |

   A do alvo de toque é a maior — 44px é bem mais alto que os ~30px de antes, e
   menu comprido cresce junto. **Abrir as telas e olhar é a única verificação
   possível**, e quanto mais camadas entrarem por cima, mais caro fica saber o
   que causou o quê. Decisão de Thiago: olhar agora, ou carregar adiante.

   > O mesmo vale para a galeria `/dev/componentes`: ela existe justamente para
   > ser olhada, e ainda não foi. Ela some em produção (`notFound()`), então só
   > dá para vê-la em desenvolvimento.

2. **A credencial do usuário de teste E2E circulou fora do controle de versão** —
   relatório de execução e transcrição de sessão. Dá acesso à conta de seed em
   staging (`ana.arquiteta@seed.arqsmart.local`), não a dado de cliente, mas é
   credencial viva num ambiente real. Rotacionar é decisão de Thiago;
   [`docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md`](docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md)
   documenta como recriar o usuário do zero.

### O que a Seção 8 herda, e que **não** é da Seção 7

Registrado aqui para não se perder, mas não é pauta de agora:

- **Existem dois `FormField` diferentes.** O da Seção 6
  (`@/components/ui/form-field`, com `id`/`rotulo`/`erro`/`sensivel`) e o do
  react-hook-form (`@/components/ui/form.tsx`, com `control`/`name`/`render`),
  este usado por **11 arquivos de tela** (medido:
  `grep -rl "from \"@/components/ui/form\"" ArchSmart-web/src --include=*.tsx | wc -l`).
  Quem migrar uma dessas telas já tem `FormField` importado — do outro. Escolher
  entre os dois é decisão da Seção 8.
- **Catraca em zero não quer dizer defeito em zero.** `cores_literais` chegando
  a 0 não significa zero cor literal: a régua não vê `bg-white`/`text-white`
  (67 hoje), hex fora de `bg|text|border`, nem `ring-offset-<paleta>-<n>`. E
  `hover_sem_focus` em 0 não significa zero: `invisible group-hover:visible` e
  `hidden group-hover:block` são o mesmo defeito e passam batido. Os furos e o
  grep de cada um estão em [`docs/dev/componentes.md`](docs/dev/componentes.md).
- **`DataTable` provavelmente não serve às telas como está** — não tem
  renderizador de célula (faz `String(valor)`), e ordena e pagina no cliente
  sobre o array inteiro, enquanto as listagens reais são paginadas no servidor.
- **Art. 8 violado em nome de evento interno:** `archsmart:budget_updated`, 4
  ocorrências em 3 arquivos (`grep -rn "archsmart:" ArchSmart-web/src`).
  Renomear é mudança de contrato entre emissor e ouvinte — mexer só nos
  emissores quebra o rodapé de totais **em silêncio**.
- **`e2e/` não roda em portão nenhum.** O `vitest.config.ts` exclui `e2e/**` e
  não há job de Playwright no CI. `hidratacao-biblioteca.spec.ts` — a única
  prova viva de que o prefetch da Seção 5 funciona — é instrumento de medição,
  não guarda permanente, e a Seção 8 vai editar exatamente a tela que ele cobre.
- **O badge do inbox (`useInboxCount()`) nunca é prefetchado** — pendência da
  Seção 5, confirmada ao vivo na Seção 6.

## Portões de CI

Desde a Seção 3, `.github/workflows/ci.yml` roda três jobs em todo PR:

```
Backend — testes contra Postgres real
Frontend — tipos, testes e catraca
Repositorio — progresso, links e sincronia
```

> ⚠️ **Eles reprovam, mas não bloqueiam — e isso é decisão tomada, não
> pendência.** Branch protection não está disponível: o repositório é privado
> num plano Free, e a API responde `404` em
> `/branches/{main,develop,staging}/protection` e `403 "Upgrade to GitHub Pro or
> make this repository public"` em `/rulesets` (medido em 25/08/2026). Um PR
> fica `mergeable: MERGEABLE`, `mergeStateStatus: UNSTABLE` — há check não-verde
> **e o merge continua permitido**.
>
> Em 26/08/2026 Thiago decidiu manter assim, sem GitHub Pro e sem tornar o
> repositório público. **Então a esteira é um conselheiro, e quem mergeia é o
> portão.** Antes de mergear, olhe os três checks; um X vermelho ali é um
> defeito real, não ruído.
>
> ⚠️ **Em 30/08/2026 o repositório foi tornado público** (`gh repo view --json
> visibility` → `PUBLIC`), para destravar a Vercel, que recusava deploy de
> repositório privado. Efeito colateral: **branch protection ficou disponível
> de graça**. Ligar ou não continua uma decisão em aberto — enquanto não for
> ligada, a regra acima vale como está. Roteiro em
> [docs/dev/ambientes-online.md](docs/dev/ambientes-online.md), seção 5.

**O que bloqueia direto:** os testes do backend contra Postgres em Docker (inclui a receita de migrações e a guarda de banco), `tsc --noEmit` e `vitest run` no frontend, os testes de `tools/`, `progresso.py --check`, `checa_links.py`, e a checagem de que `main` não tem conteúdo ausente em `develop`.

**O que é catraca:** `tools/catraca.py` mede o que hoje está errado — classes de cor literal, erros de eslint, módulos sem doc — e compara com o baseline versionado em `tools/catraca.json`. O caminho normal é o número **descer**: rode `python tools/catraca.py --atualizar` **no mesmo commit** que fez o número descer, e o script recusa gravar se alguma medida piorou.

A Seção 5 acrescentou duas medidas de frontend, para o padrão manual que ainda não migrou: `fetch_fora_de_lib_api` (ocorrências de `fetch(` em `ArchSmart-web/src/**/*.{ts,tsx}` fora de `src/lib/api/`; nasceu em 76 quando a Seção 5 registrou a medida, corrigido para 75 na revisão final da mesma seção — 1 das 76 era `fetch(` dentro de um comentário, não uma chamada real —, e é a Seção 8 quem zera, migrando as telas que restam) e `supabase_fora_de_lib_api` (ocorrências de `createBrowserClient(`/`createServerClient(` fora de `src/lib/api/` e `src/proxy.ts`; nasce em 0 — já é catraca no piso, qualquer reintrodução reprova). Registrar uma medida nova exige `--atualizar --aceitar-piora`, porque uma chave sem baseline é tratada como regressão por padrão; a Seção 5 usou o flag por isso, não porque algum número existente piorou — justificado no PR daquela seção.

A Seção 6 acrescentou quatro medidas, pelo mesmo caminho e com a mesma justificativa no PR #7: `contraste_reprovado` (pares (cor, cor-foreground) abaixo de 4.5:1 nos dois temas; nasce em **4** — `secondary` nos dois temas, que é o coral da marca, mais `destructive` e `muted` no claro. É catraca e portão ao mesmo tempo: token novo que nasça reprovado não está no baseline e reprova, sem precisar de lista de exceção), `tabindex_negativo` (**5**) e `hover_sem_focus` (**8**), que a Seção 8 zera ao migrar as telas, e `arquivos_acima_de_400` (lista nominal, **8** hoje — a Seção 6 tirou quatro dela; `BuilderClient` e `PortalBudget` continuam lá por decisão registrada).

> A Seção 6 também consertou **três cegueiras** em `comparar()`, todas do mesmo tipo — a régua dizendo verde sem olhar: medida do tipo lista sem baseline passava em silêncio; `hover_sem_focus` não via a sintaxe de grupo nomeado do Tailwind (`group-hover/opt:`) e media 5 onde eram 8; e chave que existe no baseline e **some da medição** nunca era visitada, então apagar uma linha de `medir()` desligava a medida sem um aviso. As três têm teste agora. Se você acrescentar medida, **escreva o teste dela no mesmo commit** — foi assim que as três apareceram.

Subir um número é possível e deliberadamente incômodo: exige `--atualizar --aceitar-piora`, que grava imprimindo um aviso destacado com cada medida que piorou, para o aumento ficar registrado na saída do comando e justificado no PR. E o job `Repositorio` compara o `tools/catraca.json` do PR com o da branch base — editar o número à mão, sem passar pela ferramenta, reprova ali.

A ideia está no [ADR 0006](docs/dev/decisoes/0006-portoes-de-ci-com-catraca.md): um portão que nasce vermelho é desligado na primeira semana, e aí não existe portão nenhum. Por isso o portão só barra o que já passa hoje, e o resto entra como catraca.

> **Nada de "é esperado que falhe".** Se um comando deste repositório reportar falha, é falha. A documentação já teve orientação de ignorar dois arquivos vermelhos no vitest; o defeito foi corrigido na Seção 3 e a orientação saiu junto.

## Como trabalhar aqui

**Número afirmado sem medição é número errado.** Durante a Seção 2, quatro números que circulavam na auditoria e na spec estavam errados: 137 classes de cor literal (eram **510**), 63 testes na suíte antiga (eram **83**), 13 tabelas sem `account_id` (eram **10**), 27 migrações (eram **26**). Todos sobreviveram a várias revisões de texto, e todos foram pegos por alguém que **tentou usar o número** e não conseguiu reproduzi-lo.

> Os quatro números acima são o **registro histórico** de agosto de 2026 — não meça por eles hoje. As migrações, por exemplo, voltaram a ser 27 na Seção 3, porque a Tarefa 2 acrescentou uma (`ls ArchSmart-api/alembic/versions/*.py | wc -l`).

Duas consequências práticas:

- **Ao receber um número — deste repositório ou de quem te instrui — meça antes de republicá-lo.** Se não bater, diga. Não ajuste sua contagem para casar com o que te falaram: já aconteceu nas duas direções aqui.
- **Ao afirmar um número, mostre o comando.** "Verificado por grep", sem o comando colado, já se provou falso neste repositório — o `deploy.md` afirmava que as 26 migrações tinham `downgrade()` não vazio, e são 25.
- **Enumeração fechada é uma afirmação como qualquer outra, e envelhece pior.** A Seção 3 produziu duas: "a CLI do Supabase só aceita `major_version` 14, 15 ou 17" (a varredura tinha ido de 14 a 18; 13 também passa) e "os parâmetros de query que sobrepõem o host são `host` e `hostaddr`" (faltava `dbname`, e o furo estava numa guarda de banco). Antes de escrever "são apenas estes", varra além da vizinhança — ou, melhor, troque a enumeração por uma pergunta à ferramenta que decide, que foi a correção que ficou de pé.
- **Meça no diretório em que o CI mede.** Durante a Seção 3, `python tools/checa_links.py` saía 0 a partir de `tools/` e **1** a partir da raiz — o CI roda da raiz, e medir no cwd errado fez reportar como verde um portão que o runner já reprovava (run 32804191634). Aquele link foi corrigido, então esse comando hoje sai 0 dos dois lados; o exemplo que **continua** reproduzindo é outro, no mesmo espírito:

  ```
  cd tools; python -m unittest discover -p "test_*.py"   # OK, 96 testes (10/09/2026)
  cd ..;    python -m unittest discover -s tools -p "test_*.py"   # FAILED (failures=1)
  ```

  (É `test_checa_links.py::test_nao_acusa_link_existente`; o CI escapa porque o job usa `working-directory: tools`.)

## Estrutura

| Diretório | O que é | Regras próprias |
|---|---|---|
| `ArchSmart-api/` | API em FastAPI + SQLAlchemy + PostgreSQL | [ArchSmart-api/CLAUDE.md](ArchSmart-api/CLAUDE.md) |
| `ArchSmart-web/` | Aplicação Next.js (App Router) | [ArchSmart-web/CLAUDE.md](ArchSmart-web/CLAUDE.md) |
| `extension/` | Extensão de navegador do Web Clipper | [extension/CLAUDE.md](extension/CLAUDE.md) |
| `spec-kit-2/` | Constitution, roadmap e specs de produto 001–020 | — |
| `docs/` | Documentação de desenvolvimento e de usuário | [docs/README.md](docs/README.md) |
| `tools/` | Scripts do **repositório** (checam o próprio processo: `progresso.py`, `checa_links.py`) — nunca falam com o banco da aplicação | [docs/README.md](docs/README.md) |

> Existe um segundo `tools/`, dentro de `ArchSmart-api/`, com scripts que falam com o banco da aplicação (`reset_db.py`, `seed_*.py`) — ver [ArchSmart-api/tools/README.md](ArchSmart-api/tools/README.md). São dois diretórios diferentes com o mesmo nome: um script novo que fala com o banco da aplicação nunca vai no `tools/` da raiz.

> `ArchSmart-api/` e `ArchSmart-web/` serão renomeados para `api/` e `web/` na **Seção 9**. Não renomeie antes disso — o path faz parte de muita coisa (imports, scripts, CI futuro) para trocar fora de uma tarefa dedicada.

## Proibido, sem exceção

- **Nenhum `account_id` (ou id de usuário/tenant) literal no código.** Toda leitura e escrita é filtrada pela identidade da sessão resolvida **no servidor** (Art. 1).
- **Nenhuma URL, chave ou host fixo no código.** Frontend usa `process.env.NEXT_PUBLIC_API_URL`; backend usa `app/core/config.py`; segredo vive em `.env`, nunca versionado (Art. 4).
- **Nenhuma cor literal em classe utilitária** (`bg-emerald-600`, `bg-[#F88379]`). Tudo referencia um token semântico do tema (Art. 7).
- **A marca é "Arq Smart"** — duas palavras, com Q. Zero ocorrência de `ArchSmart`, `Ark Smart` ou `Ecowe` em código, copy ou comentário. `ArchSmart-api`/`ArchSmart-web` são só nome de diretório, não grafia da marca (Art. 8).
- **Nenhuma regra de negócio ou limite de plano decidido no front.** O front renderiza o que a API devolve (`entitlements` da conta); nunca hardcoda um limite (Art. 3).

Lista completa das 15 regras, com o texto integral de cada artigo: [spec-kit-2/memory/constitution.md](spec-kit-2/memory/constitution.md).

## Rodando os testes

Backend (suíte roda contra Postgres real, não mock):

```
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
docker compose -f docker-compose.test.yml up -d --wait
pytest
```

Frontend — os mesmos dois comandos que o job de CI roda:

```
cd ArchSmart-web
npm run typecheck
npm test
```

Sai limpo: `Test Files 19 passed (19)`, `Tests 151 passed (151)` (medido em 10/09/2026, depois da Seção 6; o número sobe quando uma seção acrescenta testes — **meça, não copie daqui**). Um `failed` em qualquer das duas linhas é um teste quebrado de verdade.

Repositório, sem venv e sem instalar nada (os scripts de `tools/` usam só a biblioteca padrão):

```
python tools/catraca.py
python tools/progresso.py --check
python tools/checa_links.py
cd tools; python -m unittest discover -p "test_*.py"
```

`checa_links.py` roda **da raiz do repositório** — é assim que o CI o executa, e os caminhos relativos que ele resolve dependem disso.

## Onde ler mais

- [README.md](README.md) — visão geral do produto e como subir o ambiente.
- [docs/dev/](docs/dev/) — arquitetura, convenções, modelo de dados, deploy.
- [docs/dev/decisoes/](docs/dev/decisoes/) — ADRs: por que as coisas são como são.
- Cada subdiretório da tabela acima tem seu próprio `CLAUDE.md` com regras específicas dele — leia o dele antes de mexer lá.
