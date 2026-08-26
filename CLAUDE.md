# Arq Smart — regras do repositório

## Onde estamos

A plataforma está em **reestruturação de nove seções**. Este arquivo descreve o **alvo**, e nem tudo dele existe ainda.

Antes de escrever qualquer código:

1. Leia `PROGRESS.md` — o que já foi feito e o que continua no padrão antigo.
2. Leia `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` — o plano das nove seções.

**Código em área ainda não migrada segue o padrão antigo até a tarefa dela chegar.** Nunca migre uma área "de passagem": isso mistura mudanças, quebra a medição de desempenho e torna impossível saber o que causou uma regressão.

Estado em 26/08/2026: Seção 1 concluída (correções de segurança, merge `f190a07`). Seção 2 concluída (estrutura e documentação, merge `f167375`). Seção 3 concluída no que depende do repositório (esteira, ambientes e branches, merge `25f0bb8`); o que falta dela são passos de painel externo, com roteiro em [docs/dev/ambientes-online.md](docs/dev/ambientes-online.md) e caixas desmarcadas no `PROGRESS.md`. Seções 4 a 9 pendentes.

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
> defeito real, não ruído. O roteiro para ligar o bloqueio, caso o plano mude,
> está em [docs/dev/ambientes-online.md](docs/dev/ambientes-online.md), seção 5.

**O que bloqueia direto:** os testes do backend contra Postgres em Docker (inclui a receita de migrações e a guarda de banco), `tsc --noEmit` e `vitest run` no frontend, os testes de `tools/`, `progresso.py --check`, `checa_links.py`, e a checagem de que `main` não tem conteúdo ausente em `develop`.

**O que é catraca:** `tools/catraca.py` mede o que hoje está errado — classes de cor literal, erros de eslint, módulos sem doc — e compara com o baseline versionado em `tools/catraca.json`. O caminho normal é o número **descer**: rode `python tools/catraca.py --atualizar` **no mesmo commit** que fez o número descer, e o script recusa gravar se alguma medida piorou.

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
  cd tools; python -m unittest discover -p "test_*.py"   # OK, 44 testes
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

Sai limpo: `Test Files 4 passed (4)`, `Tests 7 passed (7)`. Um `failed` em qualquer das duas linhas é um teste quebrado de verdade.

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
