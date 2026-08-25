# Arq Smart — regras do repositório

## Onde estamos

A plataforma está em **reestruturação de nove seções**. Este arquivo descreve o **alvo**, e nem tudo dele existe ainda.

Antes de escrever qualquer código:

1. Leia `PROGRESS.md` — o que já foi feito e o que continua no padrão antigo.
2. Leia `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` — o plano das nove seções.

**Código em área ainda não migrada segue o padrão antigo até a tarefa dela chegar.** Nunca migre uma área "de passagem": isso mistura mudanças, quebra a medição de desempenho e torna impossível saber o que causou uma regressão.

Estado em 24/08/2026: Seção 1 concluída (correções de segurança, merge `f190a07`). Seção 2 concluída (estrutura e documentação, merge `f167375`). Seções 3 a 9 pendentes.

## Antes de começar a Seção 3

Dois itens em aberto que distorcem a Seção 3 (esteira, CI e ambientes) se forem ignorados:

1. **`npx vitest run` sai com erro em checkout limpo.** `ArchSmart-web/vitest.config.ts` não exclui `e2e/`, então o vitest coleta as specs do Playwright e falha em 2 arquivos — os testes de unidade reais passam. **Corrija antes de ligar o portão de CI do frontend.** Um portão que nasce vermelho é desativado na primeira semana, e aí não existe portão nenhum.

2. **Falta confirmar se o Supabase exige confirmação de e-mail** — *Authentication → Providers → Email → "Confirm email"*. Só Thiago consegue verificar, no painel. Isso decide a **urgência**, não o conteúdo, do achado de segurança em `app/api/users.py`: o auto-link por e-mail entrega a conta a quem obtiver um JWT com o e-mail da vítima, e se a confirmação estiver desligada isso é explorável hoje. A correção precisa acontecer de qualquer forma — ver a advertência em [docs/dev/arquitetura.md](docs/dev/arquitetura.md), seção "pendência de segurança conhecida".

## Como trabalhar aqui

**Número afirmado sem medição é número errado.** Durante a Seção 2, quatro números que circulavam na auditoria e na spec estavam errados: 137 classes de cor literal (eram **510**), 63 testes na suíte antiga (eram **83**), 13 tabelas sem `account_id` (eram **10**), 27 migrações (eram **26**). Todos sobreviveram a várias revisões de texto, e todos foram pegos por alguém que **tentou usar o número** e não conseguiu reproduzi-lo.

Duas consequências práticas:

- **Ao receber um número — deste repositório ou de quem te instrui — meça antes de republicá-lo.** Se não bater, diga. Não ajuste sua contagem para casar com o que te falaram: já aconteceu nas duas direções aqui.
- **Ao afirmar um número, mostre o comando.** "Verificado por grep", sem o comando colado, já se provou falso neste repositório — o `deploy.md` afirmava que as 26 migrações tinham `downgrade()` não vazio, e são 25.

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

Frontend — hoje falha em 2 arquivos por um defeito de configuração conhecido, ver `ArchSmart-web/CLAUDE.md`:

```
cd ArchSmart-web
npx vitest run
```

## Onde ler mais

- [README.md](README.md) — visão geral do produto e como subir o ambiente.
- [docs/dev/](docs/dev/) — arquitetura, convenções, modelo de dados, deploy.
- [docs/dev/decisoes/](docs/dev/decisoes/) — ADRs: por que as coisas são como são.
- Cada subdiretório da tabela acima tem seu próprio `CLAUDE.md` com regras específicas dele — leia o dele antes de mexer lá.
