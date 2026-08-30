# ADR 0003 — Descartar o banco atual e criar um novo

**Data:** 2026-08-24 · **Status:** aceita

## Contexto

A plataforma não foi lançada: não há cliente real, não há dado de produção a
preservar. O banco atual e o histórico de migrações do Alembic (26 arquivos
em `ArchSmart-api/alembic/versions/`) já divergiram um do outro pelo menos
uma vez: existiu um `ALTER TABLE` rodado à mão contra o banco
(`add_column.py`, um dos scripts de depuração descartados na Task 1 desta
seção), sem migração correspondente registrada — o schema real do banco não
é redutível só ao replay das migrações versionadas.

A Seção 4 vai adicionar `account_id` e `created_by` em 10 tabelas e criar
índices que hoje não existem — mudança de schema em massa, mais simples de
aplicar e verificar contra um banco vazio com histórico de migrações íntegro
do que contra um banco cujo schema real já é conhecido por divergir desse
histórico. A Seção 3, de qualquer forma, já provisiona um projeto Supabase de
produção separado, criado do zero pela mesma receita usada em staging e
local.

## Decisão

Descartar o banco de produção atual e criar um projeto Supabase novo, com o
schema inteiro recriado do zero a partir das migrações do Alembic — nenhum
dado migrado do banco antigo.

## Alternativas rejeitadas

- **Reconciliar o banco atual com o histórico de migrações** (auditar
  coluna a coluna contra os 26 arquivos de `alembic/versions/`, escrever uma
  migração de correção para cada divergência encontrada). Rejeitada: sem
  cliente e sem dado real para preservar, o custo de auditar e corrigir uma
  divergência já conhecida (o `ALTER TABLE` manual do `add_column.py`) não se
  paga — é trabalho gasto para preservar dado que ninguém usa.
- **Manter o banco atual e aceitar a divergência como está.** Rejeitada: a
  Seção 4 muda o schema de 10 tabelas de uma vez; partir de um schema já
  divergente do histórico de migrações torna impossível distinguir, depois,
  se uma migração nova falhou por erro dela mesma ou por causa de uma
  divergência antiga nunca registrada.

## Como saberemos se foi certo

Um `alembic upgrade head` rodado do zero contra um Postgres vazio — Docker
local, Supabase local ou o projeto novo de produção — recria o schema
inteiro sem erro e sem nenhum passo manual fora do Alembic: nenhum
`ALTER TABLE` à mão, nenhum script equivalente ao `add_column.py` descartado
na Task 1. Se, depois da Seção 3, alguém precisar tocar o schema de produção
fora de uma migração versionada, esse é o sinal de que o descarte não
eliminou a causa da divergência original — e a decisão precisa ser
revisitada.

## Consequências

Fica mais fácil: qualquer ambiente — Docker local, staging, produção — nasce
exatamente do mesmo jeito (banco vazio mais `alembic upgrade head`), que é a
premissa da
[ADR 0004](0004-alembic-fonte-unica-do-schema.md). Fica mais difícil: nada
relevante — não há dado de cliente a perder; o único custo é recriar dado de
teste ou demonstração manualmente, ou via o seed com volume realista que a
Seção 3 entrega (`tools/seed.py`).
