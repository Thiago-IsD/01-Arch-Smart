# Arq Smart — regras do repositório

## Onde estamos

A plataforma está em **reestruturação de nove seções**. Este arquivo descreve o **alvo**, e nem tudo dele existe ainda.

Antes de escrever qualquer código:

1. Leia `PROGRESS.md` — o que já foi feito e o que continua no padrão antigo.
2. Leia `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` — o plano das nove seções.

**Código em área ainda não migrada segue o padrão antigo até a tarefa dela chegar.** Nunca migre uma área "de passagem": isso mistura mudanças, quebra a medição de desempenho e torna impossível saber o que causou uma regressão.

Estado em 24/08/2026: Seção 1 concluída (correções de segurança, merge `f190a07`). Seção 2 concluída (estrutura e documentação, merge `<a preencher no merge>`). Seções 3 a 9 pendentes.

## Estrutura

| Diretório | O que é | Regras próprias |
|---|---|---|
| `ArchSmart-api/` | API em FastAPI + SQLAlchemy + PostgreSQL | [ArchSmart-api/CLAUDE.md](ArchSmart-api/CLAUDE.md) |
| `ArchSmart-web/` | Aplicação Next.js (App Router) | [ArchSmart-web/CLAUDE.md](ArchSmart-web/CLAUDE.md) |
| `extension/` | Extensão de navegador do Web Clipper | [extension/CLAUDE.md](extension/CLAUDE.md) |
| `spec-kit-2/` | Constitution, roadmap e specs de produto 001–020 | — |
| `docs/` | Documentação de desenvolvimento e de usuário | [docs/README.md](docs/README.md) |

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
