# Seção 2 — Estrutura do Repositório e Documentação · Plano de Implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** Fazer o repositório se explicar sozinho — para a segunda pessoa que vai desenvolver e para qualquer agente de IA que abra o projeto sem esta conversa.

**Arquitetura:** Nada de código de aplicação muda. A seção limpa o lixo versionado, cria a documentação que não existe e escreve os `CLAUDE.md` que dizem a um agente onde as coisas moram e o que é proibido. A reorganização de *código* (endpoints para `api/v1/routes/`, front para `features/`) pertence às Seções 4 e 5, junto com as refatorações que a justificam — mover duas vezes é desperdício.

**Stack:** Markdown · Python 3.12 (um script utilitário) · Git

**Spec:** `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` (Seção 2)

## Restrições globais

- **Nenhum arquivo de código de aplicação pode ser alterado.** Nada em `ArchSmart-api/app/`, nada em `ArchSmart-web/src/`. Se sentir vontade de melhorar algo de passagem, **não faça** — reporte como observação.
- **Os diretórios `ArchSmart-api/` e `ArchSmart-web/` mantêm os nomes.** O rename é a Seção 9.
- Grafia da marca: **Arq Smart** — duas palavras, com Q. Todo texto novo usa essa forma. `ArchSmart-api` e `ArchSmart-web` aparecem só como caminho de diretório.
- Textos em **pt-BR**, com acentuação correta.
- Commits em português, formato `tipo: descrição`.
- **Documentação afirma só o que é verdade hoje.** Se um caminho ainda não existe, diga qual seção o cria. Documento que descreve um alvo como se fosse o presente é pior que documento nenhum: um agente o segue, não encontra nada, e improvisa.

## Contexto que todas as tarefas precisam

A plataforma passa por uma reestruturação de nove seções. A **Seção 1 está concluída** (merge `f190a07`): 14 endpoints com falha de autorização fechados, harness de teste contra Postgres real em Docker, 29 testes de backend e 7 de frontend.

O que ainda **não** existe e não deve ser descrito como existente:

| Alvo | Seção que cria |
|---|---|
| `app/api/v1/routes/` com os endpoints | 4 |
| `ScopedRepository`, `RequestContext` | 4 |
| `web/src/features/`, `lib/api/`, `lib/query/` | 5 |
| CI, branch `staging`, ambiente de staging | 3 |
| `tools/seed.py` com volume realista | 3 |
| Telemetria | 7 |
| Renome dos diretórios | 9 |

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `CLAUDE.md` (raiz) | regras do repositório inteiro; primeira leitura de qualquer agente |
| `ArchSmart-api/CLAUDE.md` | convenções do backend |
| `ArchSmart-web/CLAUDE.md` | convenções do frontend |
| `extension/CLAUDE.md` | convenções da extensão |
| `README.md` (raiz) | o que é o produto, como subir, para onde ir |
| `PROGRESS.md` | contador calculado da reestruturação |
| `tools/progresso.py` | lê as caixas do `PROGRESS.md` e recalcula as porcentagens |

| `docs/README.md` | mapa da documentação: o que existe e quando escrever cada coisa |
| `docs/dev/ambiente.md` | subir o projeto do zero |
| `docs/dev/convencoes.md` | o que é obrigatório e o que é proibido, com o artigo que sustenta |
| `docs/dev/arquitetura.md` | como as peças se encaixam |
| `docs/dev/modelo-de-dados.md` | schema comentado, com o porquê de cada relação |
| `docs/dev/deploy.md` | ambientes, esteira e como reverter |
| `docs/dev/decisoes/` | ADRs |
| `docs/dev/modulos/` | um doc por módulo (preenchido pelas seções seguintes) |
| `docs/user/` | artigos por tarefa do arquiteto |
| `.github/pull_request_template.md` | checklist de revisão |
| `ArchSmart-api/tools/` | destino dos scripts que sobrevivem à triagem |

⚠️ **Existem dois diretórios `tools/` e eles são coisas diferentes.** `tools/` na raiz do repositório é ferramenta do repositório inteiro (o contador de progresso). `ArchSmart-api/tools/` é script operacional do backend (seed, reset de banco). Não misture: um script que fala com o banco da aplicação nunca vai na raiz.

---

### Task 1: Limpeza do repositório

**Files:**
- Delete: `Spec-1/` (5 arquivos), `ArchSmart-api/{add_column,check_users,debug_lead,debug_supabase_link,fix_schemas,fix_storage,revert_storage,test_filters,test_jwt,test_login,test_pagination,trace_redirect,trace_simple}.py`
- Move: `ArchSmart-api/{init_db,reset_db,seed_clipper,seed_mock,seed_products,seed_tokstok}.py` → `ArchSmart-api/tools/`
- Create: `ArchSmart-api/tools/README.md`
- Modify: `.gitignore`
- Untrack (sem apagar do disco): `ArchSmart-api/login.json`, `ArchSmart-api/mock_database.db`, `ArchSmart-api/cacert.pem`
- Commit: as deleções já pendentes de `Spec/` (5 arquivos)

**Interfaces:**
- Consumes: nada
- Produces: `ArchSmart-api/tools/` como o único lugar de script utilitário

**Nota de decisão:** os quatro `seed_*.py` são **movidos como estão**, não reescritos. A Seção 3 precisa de um seed com volume realista para staging (5 projetos, 25 ambientes, 300 itens de biblioteca, 500 itens de projeto) e vai construir `tools/seed.py` unificado lá. Reescrever agora, sem esse requisito na mão, é escrever duas vezes.

- [ ] **Passo 1: Confirmar que os descartáveis não são referenciados**

Run:
```bash
cd ArchSmart-api && for f in add_column check_users debug_lead debug_supabase_link fix_schemas fix_storage revert_storage test_filters test_jwt test_login test_pagination trace_redirect trace_simple; do
  n=$(grep -rnE "(import|from) +$f|['\"]$f\.py['\"]|[^a-zA-Z_]$f\.py" app tests Dockerfile package.json 2>/dev/null | wc -l)
  echo "$f: $n referencia(s)"
done
```
Expected: todos com `0 referencia(s)`.

⚠️ O padrão acima casa **import do módulo** ou **menção ao arquivo `.py`** — não substring solta. Um `grep "$f"` cru dá falso positivo: `test_login` casa com as funções `test_login_success` e `test_login_failure` de `app/tests/test_auth.py`, que não têm relação com o script da raiz.

⚠️ Se algum tiver referência, **pare e reporte** — não apague.

- [ ] **Passo 2: Apagar os descartáveis e o `Spec-1/`**

```bash
cd ArchSmart-api
git rm -q add_column.py check_users.py debug_lead.py debug_supabase_link.py fix_schemas.py fix_storage.py revert_storage.py test_filters.py test_jwt.py test_login.py test_pagination.py trace_redirect.py trace_simple.py 2>/dev/null || rm -f add_column.py check_users.py debug_lead.py debug_supabase_link.py fix_schemas.py fix_storage.py revert_storage.py test_filters.py test_jwt.py test_login.py test_pagination.py trace_redirect.py trace_simple.py
cd .. && rm -rf Spec-1
```

Os arquivos de `Spec/` já estão deletados no disco e pendentes no índice — o commit do Passo 6 os inclui.

- [ ] **Passo 3: Mover os que sobrevivem**

```bash
cd ArchSmart-api && mkdir -p tools
git mv init_db.py reset_db.py seed_clipper.py seed_mock.py seed_products.py seed_tokstok.py tools/ 2>/dev/null || mv init_db.py reset_db.py seed_clipper.py seed_mock.py seed_products.py seed_tokstok.py tools/
```

- [ ] **Passo 4: Escrever `ArchSmart-api/tools/README.md`**

```markdown
# Scripts utilitários

Scripts operacionais que não fazem parte da aplicação. **Nenhum deles é importado por `app/`** — se você precisar de algo daqui em tempo de execução, o lugar certo é `app/services/`.

| Script | Para quê |
|---|---|
| `init_db.py` | cria o schema num banco vazio |
| `reset_db.py` | derruba e recria o schema — **destrói dados** |
| `seed_clipper.py` · `seed_mock.py` · `seed_products.py` · `seed_tokstok.py` | populam dados de exemplo |

## Aviso

Estes scripts leem `DATABASE_URL` do ambiente. **Confira para onde ela aponta antes de rodar qualquer um** — `reset_db.py` apagado contra produção é irreversível. A suíte de testes tem uma guarda para isso (`tests/conftest.py`); estes scripts **não têm**.

## O que muda na Seção 3

Os quatro `seed_*` serão substituídos por um `tools/seed.py` único e parametrizado, capaz de gerar o volume realista contra o qual a performance de cada tela é medida. Eles estão aqui como estão até lá.
```

- [ ] **Passo 5: Parar de rastrear os três arquivos que não deviam estar no git**

```bash
cd ArchSmart-api && git rm --cached -q login.json mock_database.db cacert.pem
```

Acrescentar ao final de `.gitignore` na raiz do repositório:

```gitignore
# Artefatos locais que nunca deveriam ter sido versionados
ArchSmart-api/login.json
ArchSmart-api/mock_database.db
ArchSmart-api/cacert.pem
```

⚠️ Use `git rm --cached`, **não** `git rm`. Os arquivos continuam no disco de quem já os tem; só saem do controle de versão. O `cacert.pem` foi verificado como não referenciado por nenhum módulo (o `.dockerignore` já o documenta assim).

- [ ] **Passo 6: Verificar e commitar**

Run: `cd ArchSmart-api && ls *.py 2>/dev/null | wc -l`
Expected: `0` — nenhum script solto na raiz da API.

Run: `cd ArchSmart-api && ./venv/Scripts/python.exe -m pytest -q 2>&1 | tail -2`
Expected: `29 passed` — a limpeza não tocou em nada que a suíte use.

```bash
git add -A
git commit -m "chore: limpa o lixo versionado do repositorio

- apaga 13 scripts de depuracao e correcao pontual da raiz da API
- move init_db, reset_db e os quatro seed_* para ArchSmart-api/tools/
- para de rastrear login.json, mock_database.db e cacert.pem
- remove Spec-1/ e conclui a remocao de Spec/

Nenhum arquivo de aplicacao foi tocado."
```

---

### Task 2: README da raiz e esqueleto da documentação

**Files:**
- Create: `README.md`, `docs/README.md`, `docs/dev/README.md`, `docs/user/README.md`, `docs/dev/decisoes/README.md`, `docs/dev/modulos/README.md`

**Interfaces:**
- Consumes: nada
- Produces: a árvore de `docs/` que as Tasks 5 a 8 preenchem

- [ ] **Passo 1: Criar `README.md` na raiz**

Não existe README nenhum na raiz hoje. Ele é a primeira coisa que a pessoa nova abre. Escreva:

```markdown
# Arq Smart

Plataforma de gestão para escritórios de arquitetura: projetos, ambientes, biblioteca de produtos, orçamento e apresentação ao cliente.

## Estrutura

| Diretório | O que é |
|---|---|
| `ArchSmart-api/` | API em FastAPI + SQLAlchemy + PostgreSQL |
| `ArchSmart-web/` | Aplicação Next.js (App Router) |
| `extension/` | Extensão de navegador do Web Clipper |
| `spec-kit-2/` | Kit de produto: constitution, roadmap e specs 001–020 |
| `docs/` | Documentação de desenvolvimento e de usuário |

> Os diretórios `ArchSmart-*` serão renomeados para `api/` e `web/` na Seção 9 da reestruturação. Até lá os nomes ficam como estão.

## Começando

Suba o projeto seguindo **[docs/dev/ambiente.md](docs/dev/ambiente.md)**. Se algo naquele documento não funcionar, isso é um bug do documento — corrija-o.

## Onde ler o quê

| Pergunta | Documento |
|---|---|
| Como subo isso? | [docs/dev/ambiente.md](docs/dev/ambiente.md) |
| Como as peças se encaixam? | [docs/dev/arquitetura.md](docs/dev/arquitetura.md) |
| O que é obrigatório e o que é proibido? | [docs/dev/convencoes.md](docs/dev/convencoes.md) |
| Por que decidiram assim? | [docs/dev/decisoes/](docs/dev/decisoes/) |
| Como é o banco? | [docs/dev/modelo-de-dados.md](docs/dev/modelo-de-dados.md) |
| Como faço deploy e como reverto? | [docs/dev/deploy.md](docs/dev/deploy.md) |
| O que estamos construindo e por quê? | [spec-kit-2/](spec-kit-2/) |
| Como está a reestruturação? | [PROGRESS.md](PROGRESS.md) |

## Regras que não se negociam

As 15 regras estão em [spec-kit-2/memory/constitution.md](spec-kit-2/memory/constitution.md). As três que mais aparecem no dia a dia:

1. **Toda query é filtrada por `account_id` resolvido no servidor.** Vazamento entre contas bloqueia release.
2. **Regra de negócio mora no backend.** O front renderiza o limite, nunca o define.
3. **Cor mora no token, não no componente.** Nenhuma cor literal em classe utilitária.
```

- [ ] **Passo 2: Criar `docs/README.md`**

Este é o mapa: diz o que existe e **quando escrever cada coisa**. Sem isso, "documentar tudo" vira ninguém sabendo onde escrever.

```markdown
# Documentação

## Como está organizada

| Pasta | Para quem | Quando escrever |
|---|---|---|
| `dev/` | quem desenvolve | ao mudar como algo funciona |
| `dev/decisoes/` | quem vai questionar uma escolha | ao decidir algo não-óbvio |
| `dev/modulos/` | quem vai mexer num módulo | ao criar ou reescrever um módulo |
| `user/` | o arquiteto que usa o produto | ao entregar algo que ele faz sozinho |
| `superpowers/` | quem executa a reestruturação | specs e planos de implementação |

## As três regras

1. **Documento afirma só o que é verdade hoje.** Se algo é alvo e não realidade, diga qual seção o entrega. Um agente de IA lê isso como instrução e improvisa quando não encontra o que foi descrito.
2. **ADR para toda decisão não-óbvia.** Registre o que se decidiu, o que se rejeitou e **como saberemos se foi certo**. É o que impede a mesma discussão daqui a seis meses.
3. **Doc de módulo é entrega, não sobra.** Módulo novo sem doc correspondente não está pronto (Art. 13).

## O que ainda não existe

`dev/modulos/` está vazia: cada tela reescrita na Seção 8 entrega a sua. `user/` tem só o índice — os artigos vêm quando houver funcionalidade estável para descrever, e passam pela Giovanna antes de publicar.
```

- [ ] **Passo 3: Criar os READMEs de nível**

`docs/dev/README.md` — índice dos documentos de dev, com uma linha dizendo para que serve cada um.

`docs/user/README.md` — explica que os artigos são **por tarefa do arquiteto, não por tela** ("como monto um orçamento", não "Dashboard"), na linguagem dele, com o glossário do produto. Registra que ainda não há artigos e por quê.

`docs/dev/decisoes/README.md` — explica o formato de ADR e como numerar. Inclua o template:

```markdown
# ADR NNNN — <título curto e afirmativo>

**Data:** AAAA-MM-DD · **Status:** aceita | substituída por ADR-NNNN | revogada

## Contexto
O que era verdade quando decidimos. Fatos, não opiniões.

## Decisão
O que foi decidido, em uma frase.

## Alternativas rejeitadas
Cada uma com o motivo. Esta seção é a que mais vale daqui a seis meses.

## Como saberemos se foi certo
O sinal observável que confirma ou refuta a decisão. Sem isso, não dá para aprender com ela.

## Consequências
O que passa a ser mais fácil e o que passa a ser mais difícil.
```

`docs/dev/modulos/README.md` — explica que há um arquivo por módulo, o que ele precisa responder (o que a tela faz e para quem · endpoints e contratos · tabelas que toca · decisões não-óbvias · o que quebra se você mexer aqui), e que está vazia porque a Seção 8 a preenche.

- [ ] **Passo 4: Verificar os links**

Run:
```bash
cd "$(git rev-parse --show-toplevel)" && grep -ohE '\]\([^)#][^)]*\)' README.md docs/README.md docs/dev/README.md docs/user/README.md docs/dev/decisoes/README.md docs/dev/modulos/README.md | tr -d ']()' | while read -r p; do [ -e "$p" ] || echo "QUEBRADO: $p"; done; echo "--- fim ---"
```
Expected: nenhuma linha `QUEBRADO`.

⚠️ Links para documentos que as Tasks 5 a 8 ainda vão criar **vão aparecer como quebrados**. Isso é esperado nesta task. Anote quais e confirme no relatório que todos correspondem a arquivos previstos no mapa deste plano — um link quebrado que não esteja no mapa é erro de digitação.

- [ ] **Passo 5: Commit**

```bash
git add README.md docs/
git commit -m "docs: README da raiz e esqueleto da documentacao

O repositorio nao tinha README nenhum. Cria a arvore de docs/ com o mapa
de o que existe e quando escrever cada coisa."
```

---

### Task 3: Os quatro `CLAUDE.md`

Esta é a tarefa de maior alavancagem da seção. Em desenvolvimento assistido por IA, **o código é o prompt**: um agente lê o repositório e reproduz o que encontra. Estes arquivos são a única chance de dizer a ele o que fazer antes que ele leia um padrão ruim e o copie.

**Files:**
- Create: `CLAUDE.md`, `ArchSmart-api/CLAUDE.md`, `ArchSmart-web/CLAUDE.md`, `extension/CLAUDE.md`

**Interfaces:**
- Consumes: `docs/` da Task 2 (para os ponteiros)
- Produces: as regras que todo agente lê antes de escrever código

**Restrição de tamanho:** ~80 linhas por arquivo. Um `CLAUDE.md` de 400 linhas vira ruído e é ignorado — o que mata a utilidade dos 400. Seja imperativo e curto; profundidade vai em `docs/` com ponteiro.

- [ ] **Passo 1: `CLAUDE.md` da raiz**

Abre com o bloco de estado, que é o item mais importante do arquivo:

```markdown
# Arq Smart — regras do repositório

## Onde estamos

A plataforma está em **reestruturação de nove seções**. Este arquivo descreve o **alvo**, e nem tudo dele existe ainda.

Antes de escrever qualquer código:

1. Leia `PROGRESS.md` — o que já foi feito e o que continua no padrão antigo.
2. Leia `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` — o plano das nove seções.

**Código em área ainda não migrada segue o padrão antigo até a tarefa dela chegar.** Nunca migre uma área "de passagem": isso mistura mudanças, quebra a medição de desempenho e torna impossível saber o que causou uma regressão.

Estado em 24/08/2026: Seção 1 concluída (correções de segurança, merge `f190a07`). Seções 2 a 9 pendentes.
```

Depois, nesta ordem: estrutura do repositório em uma tabela · o que é proibido, com o artigo que sustenta · como rodar os testes · onde ler mais.

A seção de proibições precisa incluir, no mínimo:

- Nenhum `account_id` literal; toda query filtrada pela identidade da sessão resolvida no servidor (Art. 1)
- Nenhuma URL, chave ou host fixo no código (Art. 4)
- Nenhuma cor literal em classe utilitária (Art. 7)
- Grafia da marca é **Arq Smart** (Art. 8)
- Nenhuma regra de negócio ou limite de plano decidido no front (Art. 3)

- [ ] **Passo 2: `ArchSmart-api/CLAUDE.md`**

Conteúdo mínimo:

- **Onde as coisas moram hoje**: `app/api/` (três estruturas coexistindo — `api/`, `api/endpoints/`, `api/routers/`), `app/core/`, `app/db/`, `app/models/all_models.py` (arquivo único de 467 linhas), `app/schemas/`, `app/services/`, `tests/`, `tools/`
- **Onde vão morar**: `app/api/v1/routes/` como pasta única de rotas — **Seção 4**. Não mova nada agora.
- **Regra de ouro do backend**: lógica de negócio em `services/`, endpoint só orquestra
- **Escopo por conta**: hoje cada endpoint filtra por conta manualmente; a Seção 4 entrega `ScopedRepository` que torna o erro impossível. Até lá, **toda query nova filtra por `account_id` explicitamente**, e todo endpoint novo ganha um teste em `tests/isolation/`
- **Testes**: `docker compose -f docker-compose.test.yml up -d --wait` e depois `pytest`. A suíte roda contra Postgres real; `app/tests/` é a suíte antiga baseada em `MagicMock`, está fora do `testpaths` e será apagada na Seção 4 — **não escreva nada nela**
- **Erros**: mensagem em pt-BR ao usuário, rastro no log. Nunca `detail=str(e)`
- **Convenções**: tabelas `snake_case` plural, PK `id UUID`, schemas Pydantic com sufixo (`ProjectCreate`, `ProjectRead`)

- [ ] **Passo 3: `ArchSmart-web/CLAUDE.md`**

Conteúdo mínimo:

- **Onde as coisas moram hoje**: `src/app/` (App Router), `src/components/ui/` (shadcn), `src/components/`, `src/lib/`, `src/hooks/`
- **Onde vão morar**: `src/features/<dominio>/` reunindo `api.ts`, `hooks.ts` e `components/` — **Seção 5**. Não crie agora.
- **O que está medido e é o problema a não piorar**: 3,0 a 4,3 s do clique aos dados na tela; nada cacheado entre navegações; 62 `createClient()`, 56 `getSession()` e 67 headers `Authorization` montados à mão espalhados; zero `next/dynamic` em 141 arquivos
- **Até a Seção 5 existir**: se você precisar chamar a API, siga o padrão do arquivo vizinho — mas **não crie uma abstração nova**, porque `lib/api/` vai substituí-la e o trabalho será jogado fora
- **Acessibilidade**: rótulo ligado por `htmlFor`, tudo clicável focável, contraste AA nos dois temas (Art. 6)
- **Testes**: `npx vitest run`. ⚠️ Hoje ele coleta as specs do Playwright em `e2e/` e sai com erro — defeito conhecido de configuração, a ser corrigido na Seção 3
- **Cor**: token semântico sempre. Hoje há 137 desvios; não acrescente o 138º

- [ ] **Passo 4: `extension/CLAUDE.md`**

Curto. A extensão tem 281 linhas. Precisa dizer:

- O que ela faz: captura produto da página da loja e envia para a biblioteca da conta
- As **4 diretrizes do parecer jurídico** (Art. 11), que são condição de legalidade: isolamento por conta · atribuição obrigatória da fonte (`source_url` sempre visível) · canal de takedown · **captura sempre iniciada por clique humano, nunca scraper automatizado em lote**
- O defeito conhecido: `manifest.json` publica `http://localhost:3000` e `http://127.0.0.1:8000` em `host_permissions`, junto de `<all_urls>` — viola o Art. 4 e será corrigido quando a extensão for reescrita
- Que o nome no manifesto está como "Arch Smart Clipper" e o correto é **Arq Smart**

- [ ] **Passo 5: Verificar tamanho e veracidade**

Run: `wc -l CLAUDE.md ArchSmart-api/CLAUDE.md ArchSmart-web/CLAUDE.md extension/CLAUDE.md`
Expected: cada um entre 40 e 110 linhas.

Depois, **confira cada afirmação factual que você escreveu contra o repositório** — número de arquivos, caminhos, comandos. Um `CLAUDE.md` com um caminho errado manda o próximo agente para o lugar errado com autoridade. Liste no relatório o que você conferiu e como.

- [ ] **Passo 6: Commit**

```bash
git add CLAUDE.md ArchSmart-api/CLAUDE.md ArchSmart-web/CLAUDE.md extension/CLAUDE.md
git commit -m "docs: CLAUDE.md em quatro niveis

Diz a um agente de IA onde as coisas moram, o que e proibido e o que ainda
nao existe. O bloco de estado no topo evita que ele siga o alvo como se
fosse o presente e improvise ao nao encontrar."
```

---

### Task 4: `PROGRESS.md` e o script que o calcula

**Files:**
- Create: `PROGRESS.md`, `tools/progresso.py`, `tools/test_progresso.py`

**Interfaces:**
- Consumes: nada
- Produces: `python tools/progresso.py --check` (sai 1 se o número diverge das caixas) e `--write` (recalcula e grava)

**Nota de decisão:** o número é **calculado, não digitado**. Um painel que diz 60% enquanto a lista diz 40% é pior que não ter painel. A Seção 3 liga o `--check` no CI.

- [ ] **Passo 1: Escrever o teste primeiro**

`tools/test_progresso.py` — testa a função pura de contagem, sem tocar disco:

```python
"""Testes do calculador de progresso. Rode com: python -m pytest tools/test_progresso.py"""
from progresso import contar, renderizar_barra


def test_conta_caixas_marcadas_e_totais():
    texto = """
## Seção 1 · Segurança
- [x] T1.1 feito
- [x] T1.2 feito
## Seção 2 · Estrutura
- [ ] T2.1 pendente
- [x] T2.2 feito
"""
    assert contar(texto) == {
        "Seção 1 · Segurança": (2, 2),
        "Seção 2 · Estrutura": (1, 2),
    }


def test_ignora_caixas_fora_de_secao():
    texto = "- [x] solta\n## Seção 1 · A\n- [x] dentro\n"
    assert contar(texto) == {"Seção 1 · A": (1, 1)}


def test_barra_reflete_a_proporcao():
    assert renderizar_barra(0, 4).count("█") == 0
    assert renderizar_barra(4, 4).count("█") == 20
    assert renderizar_barra(2, 4).count("█") == 10


def test_secao_vazia_nao_divide_por_zero():
    assert renderizar_barra(0, 0).count("█") == 0
```

- [ ] **Passo 2: Rodar e confirmar que falha**

Run: `cd tools && python -m pytest test_progresso.py -q`
Expected: FALHA com `ModuleNotFoundError: No module named 'progresso'`.

- [ ] **Passo 3: Escrever `tools/progresso.py`**

Requisitos:

- `contar(texto) -> dict[str, tuple[int, int]]` — para cada cabeçalho `## `, conta `- [x]` e o total de `- [ ]`/`- [x]` abaixo dele
- `renderizar_barra(feitos, total, largura=20) -> str` — barra de `█` e `░`; total zero devolve barra vazia sem dividir por zero
- CLI: `--check` compara os números escritos no arquivo com os calculados e sai com código 1 se divergirem, imprimindo a diferença; `--write` recalcula e grava
- Sem dependências além da biblioteca padrão

- [ ] **Passo 4: Rodar e confirmar que passa**

Run: `cd tools && python -m pytest test_progresso.py -q`
Expected: `4 passed`.

- [ ] **Passo 5: Escrever `PROGRESS.md`**

Uma seção `## ` por seção do plano, com uma caixa por tarefa. Seção 1 vem toda marcada — está concluída. As demais entram com as tarefas que já conhecemos pela spec; onde ainda não há plano detalhado, uma caixa por entrega nomeada na spec.

O cabeçalho traz a barra geral e a data da última atualização. Inclua uma linha explicando que o número é calculado e como regenerá-lo.

- [ ] **Passo 6: Verificar que o `--check` funciona nos dois sentidos**

Run: `python tools/progresso.py --check`
Expected: sai 0, sem divergência.

Agora prove que ele detecta divergência: edite à mão uma porcentagem no `PROGRESS.md` para um valor errado, rode `--check` de novo, confirme que sai 1 e imprime a diferença, e **desfaça a edição**. Cole as duas saídas no relatório.

Um verificador que nunca falha não verifica nada — este passo é o que prova que ele funciona.

- [ ] **Passo 7: Commit**

```bash
git add PROGRESS.md tools/
git commit -m "docs: PROGRESS.md com contador calculado

O numero sai das caixas marcadas, nao e digitado — 'progresso.py --check'
falha se divergirem. A Secao 3 liga essa verificacao no CI."
```

---

### Task 5: `docs/dev/ambiente.md`

**Files:**
- Create: `docs/dev/ambiente.md`
- Modify: `ArchSmart-api/.env.example`, e criar `ArchSmart-web/.env.example` se não existir

**Interfaces:**
- Consumes: `docs/dev/README.md` da Task 2
- Produces: o documento cujo critério de aceite é uma pessoa nova subir o projeto sozinha

**O critério de aceite desta task é diferente das outras.** A spec 004 diz: *o Brenno sobe o projeto seguindo só a doc, em menos de 30 minutos, sem perguntar nada.* Você não tem o Brenno, então o substituto honesto é: **execute você mesmo cada comando que escrever, num shell limpo, e cole a saída real.** Documento de ambiente que nunca foi executado é ficção.

- [ ] **Passo 1: Levantar o que é realmente necessário**

Confira e anote:
- Versão de Python (`ArchSmart-api/venv` foi criado com qual? veja `venv/pyvenv.cfg`)
- Versão de Node (`ArchSmart-web/package.json`, campo `engines` se houver; senão, o que o Next 16 exige)
- Variáveis obrigatórias do backend: leia `app/core/config.py` e liste **todas** as marcadas `Field(...)` sem default
- Variáveis obrigatórias do frontend: leia `src/lib/env.ts`
- O que o Docker precisa rodar

- [ ] **Passo 2: Escrever o documento**

Estrutura sugerida: pré-requisitos com versões · clonar · backend passo a passo · frontend passo a passo · banco de teste em Docker · como rodar as suítes · **problemas conhecidos** · como saber que deu certo.

A seção de problemas conhecidos precisa incluir, no mínimo:
- `npx vitest run` sai com erro porque coleta as specs do Playwright em `e2e/` — defeito de configuração conhecido, correção na Seção 3
- O `git pull`/`git push` pedem credencial do remote HTTPS
- Sem `.env` populado, importar `app.main` levanta `ValidationError` do pydantic e a suíte falha na coleta

Documentar o problema conhecido vale mais que escondê-lo: quem trava nele às 23h sem aviso perde a noite.

- [ ] **Passo 3: Completar os `.env.example`**

`ArchSmart-api/.env.example` precisa listar **todas** as variáveis obrigatórias do `config.py`, com um comentário por linha dizendo o que é e onde obter. Confirme que `GEMINI_API_KEY` está lá.

`ArchSmart-web/.env.example`: se não existir, crie com as três de `src/lib/env.ts`.

Use valores fictícios e óbvios (`sua-chave-aqui`), nunca valores reais.

- [ ] **Passo 4: Executar o próprio documento**

Siga o que você escreveu, comando a comando, e cole a saída real de cada um no relatório. Onde não der para executar num ambiente já montado (por exemplo, criar o venv do zero), **diga isso explicitamente** em vez de fingir que rodou.

Se um comando falhar, o documento está errado — corrija o documento, não a realidade.

- [ ] **Passo 5: Commit**

```bash
git add docs/dev/ambiente.md ArchSmart-api/.env.example ArchSmart-web/.env.example
git commit -m "docs: ambiente.md, com os comandos de fato executados

Inclui os problemas conhecidos que fazem alguem travar: vitest coletando
specs do Playwright, credencial do remote HTTPS, e a suite falhando na
coleta sem .env populado."
```

---

### Task 6: `docs/dev/convencoes.md` e `docs/dev/arquitetura.md`

**Files:**
- Create: `docs/dev/convencoes.md`, `docs/dev/arquitetura.md`

**Interfaces:**
- Consumes: nada
- Produces: `convencoes.md` vira a fonte das regras de lint da Seção 3

- [ ] **Passo 1: `convencoes.md`**

Duas metades: **obrigatório** e **proibido**. A metade proibida é a que importa, e cada item precisa de três coisas — a regra, o artigo da constitution que a sustenta, e **por que ela existe** (o defeito concreto que ela evita, com o número medido quando houver).

Cubra no mínimo:

| Proibido | Art. | Por quê |
|---|---|---|
| `account_id` literal ou vindo do cliente | 1 | 14 endpoints vazavam dado entre contas |
| URL, chave ou host fixo no código | 4 | o `manifest.json` da extensão publica `localhost` |
| Cor literal em classe utilitária | 7 | 137 desvios hoje; o rebranding vira varredura manual |
| `ArchSmart`, `Ark Smart` ou `Ecowe` em texto | 8 | 60 arquivos com a grafia errada |
| `tabIndex={-1}` em controle interativo | 6 | 5 ocorrências tornam o controle inalcançável por teclado |
| `opacity-0 group-hover` sem `focus-within` | 6 | 9 ocorrências escondem a ação de quem navega por teclado |
| Limite de plano decidido no front | 3 | `planLimit ?? 2` e "Plano Solo" fixo na tela de projetos |
| `detail=str(e)` na resposta | — | vaza exceção interna ao cliente |
| Teste com banco mockado | — | 83 testes não detectaram 14 vazamentos |

Registre também as convenções de nomenclatura (tabelas, models, schemas, componentes, eventos) e o formato de commit.

- [ ] **Passo 2: `arquitetura.md`**

Precisa responder a quem chegou hoje: quais são as peças e como conversam · como a identidade é resolvida (JWT do Supabase → `supabase_id` → linha `User` → `account_id`) · como o escopo por conta funciona hoje e o que a Seção 4 muda · onde mora a regra de negócio · o que roda onde (Vercel, Render, Supabase) · o que está medido e é problema conhecido.

Inclua a advertência sobre `app/api/users.py`: o auto-link por e-mail é uma pendência de segurança conhecida, com tarefa própria. Quem for mexer em autenticação precisa saber disso antes de tocar no arquivo.

- [ ] **Passo 3: Conferir cada afirmação factual**

Todo número, caminho e nome de arquivo que você escrever precisa ser verificado contra o repositório. Liste no relatório o que conferiu.

- [ ] **Passo 4: Commit**

```bash
git add docs/dev/convencoes.md docs/dev/arquitetura.md
git commit -m "docs: convencoes e arquitetura

convencoes.md registra cada proibicao com o artigo que a sustenta e o
defeito concreto que ela evita — e vira a fonte das regras de lint da Secao 3."
```

---

### Task 7: `docs/dev/modelo-de-dados.md`

**Files:**
- Create: `docs/dev/modelo-de-dados.md`

**Interfaces:**
- Consumes: `ArchSmart-api/app/models/all_models.py`
- Produces: o documento que a Seção 4 usa para planejar a migração de `account_id`

Este documento tem exigência própria: **o porquê de cada relação, não só o DDL.** Um dump do schema não ajuda ninguém — o Postgres já sabe o schema. O que não está em lugar nenhum é por que `BudgetItem` aponta para `Environment` de forma opcional, ou por que `ItemOption` existe em vez de o produto pendurar direto no item.

- [ ] **Passo 1: Ler o modelo inteiro**

`app/models/all_models.py`, 467 linhas, **26 tabelas**. Leia tudo antes de escrever qualquer coisa.

- [ ] **Passo 2: Escrever o documento**

Organize por agregado, não alfabeticamente: **Conta e identidade** (`accounts`, `users`, `subscriptions`, `plans`) · **Projeto** (`projects`, `clients`, `environments`, `environment_dnas`) · **Biblioteca** (`products`, `product_states`, `product_origins`) · **Orçamento** (`budgets`, `budget_items`, `item_options`) · **Apresentação** (`presentations`, `presentation_environments`, `presentation_acceptances`, `presentation_comments`) · **Financeiro** (`financial_entries`) · **Operacional** (`events`, `notifications`, `admin_logs`, `documents`, `leads`, `legal_acceptances`, `project_slots`)

Para cada agregado: o que representa no negócio, as relações e por que são assim, e o que quebra se mexer.

Registre explicitamente, porque é o que a Seção 4 precisa:

- **Quais tabelas têm `account_id` hoje** e quais não têm (13 não têm). Para as que não têm, qual é o caminho até a conta (`BudgetItem → Budget → Project → account_id`)
- **Que `created_by` não existe em nenhuma tabela**
- **Que só há 4 índices** no modelo inteiro e nenhum em `account_id` — e que é isso que faz a plataforma ficar mais lenta conforme a conta acumula dados
- **Que `Document.embedding` é `Vector(1536)`** e exige a extensão `vector` no Postgres

- [ ] **Passo 3: Conferir a lista de tabelas contra o código**

Run: `cd ArchSmart-api && grep -c "__tablename__" app/models/all_models.py`

Confirme que o número de tabelas que você documentou bate. Cole a saída no relatório.

- [ ] **Passo 4: Commit**

```bash
git add docs/dev/modelo-de-dados.md
git commit -m "docs: modelo de dados comentado

Por agregado, com o porque de cada relacao. Registra o que a Secao 4 precisa:
13 tabelas sem account_id, created_by inexistente e apenas 4 indices."
```

---

### Task 8: `docs/dev/deploy.md`, as ADRs e o processo de revisão

**Files:**
- Create: `docs/dev/deploy.md`, `docs/dev/decisoes/0001-*.md` a `0005-*.md`, `.github/pull_request_template.md`, `.github/CODEOWNERS`, `tools/checa_links.py`

**Interfaces:**
- Consumes: o template de ADR da Task 2
- Produces: o checklist que toda revisão de PR usa

- [ ] **Passo 1: `docs/dev/deploy.md`**

Cubra: onde cada peça roda hoje (Vercel, Render, Supabase) · o que existe de esteira hoje (**nada além de dois workflows de keep-alive** — não invente) · o procedimento de migração de banco em passos separados (adicionar coluna nula → backfill em lotes → verificar → `NOT NULL` + FK + índice) · **como reverter em 5 minutos** · o que a Seção 3 vai mudar.

A seção de reversão é a que se lê às 2h da manhã. Escreva-a assim: comandos exatos, sem prosa.

- [ ] **Passo 2: Escrever as cinco ADRs**

Uma por decisão, seguindo o template. Todas com a seção "como saberemos se foi certo" preenchida — é ela que permite aprender.

| # | Título | Núcleo |
|---|---|---|
| 0001 | Manter Vercel, Render e Supabase no beta | Art. 14; AWS só depois de clientes |
| 0002 | Reestruturar em vez de reescrever | stack atual, 57 de 70 endpoints corretos, defeitos de processo; medir por tempo de clique-a-dados e custo de criar tela nova |
| 0003 | Descartar o banco atual e criar um novo | nada lançado; dispensa reconciliar divergência entre schema e migrações |
| 0004 | Alembic como fonte única do schema | Supabase local é infraestrutura; duas ferramentas versionando o mesmo schema perdem o controle dele |
| 0005 | Três branches: `develop`, `staging`, `main` | duas pessoas mais beta-testers em staging; `develop` é onde o trabalho se encontra sem publicar |

Para a 0002, a seção de alternativas rejeitadas precisa registrar as duas que foram de fato consideradas: aplicação nova em paralelo com corte no fim, e otimização cirúrgica sem camada base.

- [ ] **Passo 3: `.github/pull_request_template.md`**

Checklist curto e verificável. Itens longos não são lidos. No mínimo: query nova filtrada por `account_id` com teste de isolamento · nenhuma cor, URL, ID ou limite literal introduzido · os 5 estados quando for tela · doc de módulo atualizada · testado em 390px e 1440px quando for tela.

- [ ] **Passo 4: `.github/CODEOWNERS`**

Duas pessoas apenas. Mantenha simples e comente que se torna mais granular quando o time crescer.

- [ ] **Passo 5: Criar o verificador de links e rodá-lo em tudo**

Crie `tools/checa_links.py`:

```python
"""
Verifica links relativos em arquivos Markdown.

Resolve cada link contra o diretorio do arquivo que o contem — nao contra a
raiz do repositorio. Resolver contra a raiz produz falso positivo em todo
link relativo escrito de dentro de uma subpasta.

Uso: python tools/checa_links.py [caminho ...]      (padrao: todos os .md rastreados)
Sai 1 se houver link quebrado.
"""
import re
import subprocess
import sys
from pathlib import Path

PADRAO = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def arquivos_md(args):
    if args:
        return [Path(a) for a in args]
    saida = subprocess.run(
        ["git", "ls-files", "*.md"], capture_output=True, text=True, check=True
    ).stdout
    return [Path(l) for l in saida.splitlines() if l]


def quebrados(caminho):
    achados = []
    for alvo in PADRAO.findall(caminho.read_text(encoding="utf-8")):
        alvo = alvo.split()[0]
        if alvo.startswith(("http://", "https://", "mailto:", "#")):
            continue
        alvo = alvo.split("#")[0]
        if not alvo:
            continue
        if not (caminho.parent / alvo).exists():
            achados.append(alvo)
    return achados


def main():
    total = 0
    for md in arquivos_md(sys.argv[1:]):
        if not md.exists():
            continue
        for alvo in quebrados(md):
            print(f"QUEBRADO: {md} -> {alvo}")
            total += 1
    print(f"--- {total} link(s) quebrado(s) ---")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())```

⚠️ O ponto do script é resolver cada link **contra o diretório do arquivo que o contém**, não contra a raiz do repositório. Uma verificação por `grep` ingênua dá falso positivo em todo link relativo escrito de dentro de uma subpasta — foi o que aconteceu na Task 2.

Run: `python tools/checa_links.py`
Expected: `--- 0 link(s) quebrado(s) ---`, saída 0.

Agora que todas as tasks rodaram, nenhum link deveria estar quebrado. Se algum estiver, corrija o link ou crie o arquivo faltante.

Acrescente o arquivo à lista de Files desta task.

- [ ] **Passo 6: Commit**

```bash
git add docs/dev/deploy.md docs/dev/decisoes/ .github/
git commit -m "docs: deploy, cinco ADRs e checklist de PR

Cada ADR registra o que se rejeitou e como saberemos se a decisao foi certa —
sem isso nao da para aprender com ela."
```

---

## Verificação final da Seção 2

- [ ] `ls ArchSmart-api/*.py 2>/dev/null | wc -l` → `0`
- [ ] `cd ArchSmart-api && ./venv/Scripts/python.exe -m pytest -q` → `29 passed`
- [ ] `python tools/progresso.py --check` → sai 0
- [ ] `git ls-files | grep -E "login.json|mock_database.db|cacert.pem"` → vazio
- [ ] Nenhum link quebrado em nenhum `.md` criado nesta seção
- [ ] `git diff --stat develop..HEAD -- ArchSmart-api/app ArchSmart-web/src` → **vazio**; nenhum código de aplicação foi tocado
- [ ] Os quatro `CLAUDE.md` existem, entre 40 e 110 linhas cada, e abrem com o bloco de estado

**O que esta seção deliberadamente NÃO faz:** não move endpoint para `api/v1/routes/` (Seção 4), não cria `features/` nem `lib/api/` (Seção 5), não escreve o CI (Seção 3), não constrói o seed com volume realista (Seção 3), não renomeia diretório (Seção 9), não corrige o `vitest.config.ts` (Seção 3 — está documentado como problema conhecido). Cada uma dessas tem seção própria, e antecipá-las aqui significa fazer duas vezes.
