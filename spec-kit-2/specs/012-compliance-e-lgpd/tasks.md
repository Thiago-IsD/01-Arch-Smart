# Tasks 012 — Compliance e LGPD

## Dependência externa (acompanhar, não executar)

- [ ] **T-012.0** — Confirmar com o Brenno os 3 documentos publicados, **com o nome corrigido para Arq Smart** e e-mails que existem
  - Bloqueia: T-012.2, T-012.13

## Aceites

- [ ] **T-012.1** — Migração `legal_acceptances`
- [ ] **T-012.2** — Serviço de aceite com versionamento
  - Aceite: grava `document_type`, `document_version`, IP, user agent; nunca sobrescreve aceite anterior
- [ ] **T-012.3** — Telas de aceite no cadastro
  - Aceite: 3 documentos, cada um com link para o texto completo, aceite explícito
- [ ] **T-012.4** — Reaceite em nova versão
  - Aceite: mostra o que mudou; bloqueia o uso até aceitar

## Consentimento

- [ ] **T-012.5** — Tela de consentimento de analytics e replay
  - Aceite: separada dos termos; explica o que é coletado e o que é mascarado
- [ ] **T-012.6** — Bloqueio de coleta antes do consentimento
  - Aceite: verificado nas ferramentas de rede — nenhuma requisição de analytics antes da escolha
- [ ] **T-012.7 [P]** — Revisão do consentimento em Configurações

## Portabilidade

- [ ] **T-012.8** — Serviço de export completo da conta
  - Arquivo: `app/services/data_export.py`
  - Aceite: .zip com cadastro, projetos, biblioteca, transações e orçamentos, em JSON + CSV
- [ ] **T-012.9** — Fila assíncrona + e-mail com o link
  - Aceite: entrega em até 48h; link expira

## Exclusão

- [ ] **T-012.10** — Fluxo de exclusão com janela de 30 dias
  - Aceite: confirmação por digitação do nome; `READ_ONLY` imediato; cancelável
- [ ] **T-012.11** — Job de expurgo definitivo
  - Aceite: apaga dado pessoal; retém log de acesso pelos 6 meses legais
- [ ] **T-012.12 [P]** — Job de expurgo de logs após 6 meses

## Takedown

- [ ] **T-012.13** — Página pública `/takedown` + `takedown_requests`
- [ ] **T-012.14** — Fluxo interno de análise e aplicação
  - Aceite: aceitar marca `takedown_at` nos itens daquele `source_url` em todas as contas
- [ ] **T-012.15** — Aviso aos arquitetos afetados
  - Aceite: item some da biblioteca; **não** some de orçamento já exportado

## Legal

- [ ] **T-012.16** — Página `/legal` com documentos versionados e histórico
- [ ] **T-012.17** — Varredura de links e e-mails
  - Aceite: nenhum link ou e-mail apontando para nome ou domínio antigo

## Telemetria e docs

- [ ] **T-012.18** — Os 6 grupos de eventos de §10
- [ ] **T-012.19** — `docs/dev/modulos/compliance.md` + artigos de usuário

---

## Definition of Done

- [ ] Critérios de aceite da spec §11 atendidos
- [ ] Nenhuma coleta antes do consentimento, verificado no navegador
- [ ] Export e exclusão testados ponta a ponta numa conta real de teste
- [ ] Takedown testado: item some da biblioteca e permanece no orçamento exportado
- [ ] Zero referência a nome ou domínio antigo
