# ADR 0001 — Manter Vercel, Render e Supabase no beta

**Data:** 2026-08-24 · **Status:** aceita

## Contexto

O frontend roda hoje na Vercel, a API no Render e o banco (também Auth) no
Supabase, projeto do time em São Paulo (`aws-1-sa-east-1.pooler.supabase.com`)
— ver [`deploy.md`](../deploy.md). O Art. 14 da constitution já registra essa
escolha como decidida para o beta: "Infraestrutura do beta: Vercel + Render +
Supabase, decidido. AWS só perto da aquisição de clientes, e nunca durante o
beta." A plataforma não tem cliente pagante hoje, e está no meio de uma
reestruturação de nove seções que já concentra risco suficiente sem trocar de
infraestrutura ao mesmo tempo.

## Decisão

Manter Vercel (frontend), Render (API) e Supabase (banco/Auth) durante todo o
beta. Migração para AWS só é avaliada depois da aquisição dos primeiros
clientes — nunca antes, e nunca como antecipação de escala que ainda não
existe.

## Alternativas rejeitadas

- **Migrar para AWS agora, antecipando escala futura.** Rejeitada: não há
  usuário pagante hoje (Art. 14) — infraestrutura dimensionada para uma
  carga que não existe é dívida sem receita correspondente. Trocar de
  provedor no meio da reestruturação de nove seções também introduziria uma
  variável de risco não medida, competindo por atenção com o trabalho que já
  está em andamento.

## Como saberemos se foi certo

Enquanto não houver cliente pagante, o custo de infraestrutura permanece
dentro do tier gratuito/baixo custo das três plataformas, e nenhuma
limitação delas (cold start de ~20s do Render após ~15 min de inatividade,
pausa do Supabase após ~7 dias) chega a bloquear uma demonstração real do
produto ou o trabalho de desenvolvimento — hoje essas duas limitações já são
mitigadas por `keep-alive.yml` e `keep-db-alive.yml`. Se qualquer uma delas
passar a afetar um cliente real ou uma demonstração importante, esse é o
sinal concreto para revisitar esta decisão antes da aquisição de clientes,
não depois. Gatilho explícito de revisão: assinatura do primeiro contrato de
cliente.

## Consequências

Fica mais fácil: manter o foco da reestruturação na arquitetura da aplicação
em vez de em infraestrutura nova; custo previsível e baixo enquanto não há
receita. Fica mais difícil: portar para AWS mais tarde depende de dois
pontos de contato únicos que a Seção 3 desenha (`lib/api/auth.ts` e um
adaptador de storage) para que a troca custe dois arquivos, não os 62 call
sites espalhados hoje — e depende também de o schema nunca usar um recurso
exclusivo do Supabase (RLS como única proteção, função do Supabase, FK para
tabela interna de autenticação deles), regra que a
[ADR 0004](0004-alembic-fonte-unica-do-schema.md) já sustenta.
