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
| Quais são as regras para um agente de IA trabalhar aqui? | [CLAUDE.md](CLAUDE.md) |

## Regras que não se negociam

As 15 regras estão em [spec-kit-2/memory/constitution.md](spec-kit-2/memory/constitution.md). As três que mais aparecem no dia a dia:

1. **Toda query é filtrada por `account_id` resolvido no servidor.** Vazamento entre contas bloqueia release.
2. **Regra de negócio mora no backend.** O front renderiza o limite, nunca o define.
3. **Cor mora no token, não no componente.** Nenhuma cor literal em classe utilitária.
