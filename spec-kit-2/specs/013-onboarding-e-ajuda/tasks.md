# Tasks 013 — Onboarding e ajuda

## Conteúdo (Giovanna — paralelo ao código)

- [ ] **T-013.1** — Roteiro do vídeo tutorial (≤4 min, do login ao export)
- [ ] **T-013.2** — Gravar e hospedar o vídeo
  - Aceite: link estável, legenda em pt-BR, sem edição elaborada
- [ ] **T-013.3** — Roteiro do 1:1, com os **10 primeiros minutos sem intervenção**
- [ ] **T-013.4** — E-mail de boas-vindas
- [ ] **T-013.5** — Curadoria dos ~30 itens da biblioteca semeada (dados genéricos)
- [ ] **T-013.6** — Escrever os artigos obrigatórios de `/docs/user/`
  - Aceite: 9 artigos da spec §8, no formato do template

## Backend

- [ ] **T-013.7** — Migração: `users.onboarding_state`, `onboarding_completed_at`, `projects.is_sample`
- [ ] **T-013.8** — `GET`/`PATCH /api/v1/me/onboarding`
- [ ] **T-013.9** — Serviço do projeto de exemplo
  - Aceite: cria projeto + 3 ambientes + itens **na conta do usuário**; `is_sample = true`
- [ ] **T-013.10** — Seed da biblioteca inicial no cadastro
  - Aceite: ~30 itens na conta do novo usuário; endpoint para apagar todos

## Frontend

- [ ] **T-013.11** — Modal de boas-vindas com vídeo (uma vez só)
- [ ] **T-013.12** — Widget de checklist no dashboard
  - Aceite: 7 passos com progresso real; some ao concluir
- [ ] **T-013.13** — Banner e remoção do projeto de exemplo
- [ ] **T-013.14 [P]** — Card de instalação do Web Clipper

## Central de ajuda

- [ ] **T-013.15** — Rota `/ajuda` renderizando `/docs/user/`
- [ ] **T-013.16** — Busca por texto nos artigos
- [ ] **T-013.17** — Link contextual de cada `EmptyState` para o artigo relevante

## Suporte

- [ ] **T-013.18** — Canal de e-mail com SLA 48h e rodízio definido
  - Aceite: testado com uma mensagem real

## Telemetria e verificação

- [ ] **T-013.19** — Eventos de onboarding e ajuda (§11)
- [ ] **T-013.20** — Teste de corredor com 3 pessoas de fora do time
  - Aceite: as 3 chegam ao export em <30 min sem ajuda; travas anotadas
- [ ] **T-013.21** — Corrigir o que apareceu e retestar com uma pessoa nova

---

## Definition of Done

- [ ] Critérios de aceite da spec §13 atendidos
- [ ] Vídeo no ar e linkado no produto
- [ ] Projeto de exemplo na conta do próprio usuário (Art. 1)
- [ ] `/ajuda` com os 9 artigos obrigatórios
- [ ] 3 testes de corredor concluídos, com correções aplicadas
- [ ] Kit do beta-tester completo
