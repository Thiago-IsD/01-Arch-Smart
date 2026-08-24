# ADR 0004 — Alembic como fonte única do schema

**Data:** 2026-08-24 · **Status:** aceita

## Contexto

A Seção 3 introduz Supabase local via CLI (Postgres + Auth + Storage +
Studio, em Docker) para que o desenvolvimento não dependa da nuvem para
autenticação e upload. A CLI do Supabase tem seu próprio sistema de migração
(`supabase migration ...`), independente do Alembic que a API já usa hoje (26
arquivos em `ArchSmart-api/alembic/versions/`).

Portabilidade para AWS é objetivo declarado para depois da aquisição de
clientes (ver [ADR 0001](0001-manter-vercel-render-supabase.md)): o schema
não pode depender de recurso exclusivo do Supabase (RLS como única proteção,
função do Supabase, FK para tabela interna de autenticação deles) para
continuar portável quando esse dia chegar. Se duas ferramentas — Alembic e a
CLI do Supabase — versionarem o mesmo schema, cada uma passa a ter sua
própria visão de "estado atual do banco"; na primeira vez que divergirem, não
há como saber qual delas está certa sem auditoria manual — o mesmo problema
que já levou à [ADR 0003](0003-descartar-banco-atual-criar-novo.md).

## Decisão

Alembic é a única fonte de verdade do schema, em todo ambiente — Docker
local, staging, produção. Supabase (local ou remoto) é usado só como
infraestrutura (Postgres, Auth, Storage), nunca como sistema de migração de
schema: a CLI do Supabase não roda `supabase migration`.

## Alternativas rejeitadas

- **Usar a migração da CLI do Supabase e abandonar o Alembic.** Rejeitada: a
  API já depende do Alembic hoje, com todo o histórico do schema nos 26
  arquivos existentes; trocar de ferramenta agora descartaria esse histórico
  sem necessidade, e prenderia o schema a recursos específicos do Supabase,
  contrariando o objetivo de portabilidade da ADR 0001.
- **Usar as duas em paralelo** (Alembic para as tabelas de aplicação, CLI do
  Supabase para o que for específico dele — políticas de RLS, por exemplo).
  Rejeitada: um schema com duas fontes de verdade perde o controle de qual
  delas está correta assim que divergirem — é exatamente o padrão que o
  `add_column.py` (ADR 0003) já mostrou ser caro de descobrir depois do fato.

## Como saberemos se foi certo

Qualquer Postgres vazio — Docker local, staging, produção — vira o schema
esperado rodando só `alembic upgrade head`, sem nenhum comando de migração da
CLI do Supabase envolvido. Se, em algum momento, alguém precisar rodar
`supabase migration up` (ou equivalente) para o schema ficar completo, a
fonte única foi violada e a decisão precisa ser revisitada.

## Consequências

Fica mais fácil: um único histórico de schema para auditar, revisar em PR e
portar entre ambientes — inclusive para fora do Supabase, se a ADR 0001 for
revisitada depois da aquisição de clientes. Fica mais difícil: qualquer
funcionalidade do Supabase que normalmente nasceria de sua própria migração
(por exemplo, uma política de RLS gerada pela CLI) precisa ser escrita como
SQL dentro de uma migração do Alembic quando for necessária — nunca gerada
automaticamente pela ferramenta do Supabase.
