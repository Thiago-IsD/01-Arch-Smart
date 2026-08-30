# Constitution — Arq Smart

> Princípios não-negociáveis de produto e engenharia.
> Toda spec, todo plano e todo PR são avaliados contra este documento.
> Se uma spec contradiz a constitution, **a constitution ganha** e a spec está errada.
> Alterar um artigo exige acordo dos 4 sócios e registro no `HISTORICO.md` do projeto.

**Versão 2.0 — 23/08/2026** · Revisada após as atas de 11/08 e 18/08 e o parecer jurídico.

---

## Art. 1 — Isolamento de dados é inegociável

Nenhum identificador de conta, usuário ou tenant pode ser literal no código. Toda leitura e toda escrita são filtradas pela identidade da sessão autenticada, resolvida **no servidor**.

- Toda tabela com dado de cliente carrega `account_id` e é consultada sempre com esse filtro.
- **Nenhum recurso do usuário é acessível por link público não autenticado.** Produto capturado, orçamento, apresentação e prancha exigem sessão válida ou token assinado com escopo e expiração.
- Se a plataforma usa RLS (Supabase/Postgres), a policy é a segunda linha de defesa — **não** a primeira. A query já vem filtrada.
- **Critério de aceite universal:** para qualquer endpoint novo, existe um teste que autentica como conta A e prova que o dado da conta B não retorna.

Violação deste artigo é `P0` e bloqueia release, sem exceção. Vazamento entre contas em um SaaS B2B mata o produto antes do PMF — e, no nosso caso, viola a diretriz nº 1 do parecer jurídico do Web Clipper.

## Art. 2 — `account_id` e `user_id` são conceitos separados desde o dia 1

Hoje toda conta tem um usuário só. Isso vai mudar (escritórios com equipe — spec 020). O modelo já nasce com os três conceitos distintos:

- `account_id` — a quem o dado pertence (o escritório). **É o tenant.**
- `user_id` — quem está logado.
- `created_by` — quem criou o registro.

Custa quase nada agora e evita uma migração dolorosa sobre uma base com clientes pagando.

## Art. 3 — Regra de negócio mora no backend

Limites de plano, cotas, permissões e preços vêm da API. O front-end **renderiza** o limite, nunca o **define**.

- O endpoint de sessão devolve as *entitlements* da conta (`max_projects`, `max_ai_tokens_month`, `features[]`).
- Mudar o que um plano oferece deve ser alteração de **dado**, não de código.
- Estados de assinatura são os três publicados no Termo de Uso: **`BETA`, `ACTIVE`, `READ_ONLY`**. Não invente um quarto sem alterar o documento jurídico junto.

## Art. 4 — Ambiente nunca é literal

Nenhuma URL, chave ou host fixo no código. Frontend: `process.env.NEXT_PUBLIC_API_URL`. Backend: `app/core/config.py`. Segredo em `.env`, nunca versionado. Chave de IA jamais chega ao browser.

## Art. 5 — Convenções de código são fixas

| Camada | Regra |
|---|---|
| PostgreSQL | tabelas `snake_case` **plural**; colunas `snake_case`; PK sempre `id UUID` |
| FastAPI | Models `PascalCase`; funções e variáveis `snake_case`; schemas Pydantic = `Model` + sufixo (`ProjectCreate`, `ProjectRead`) |
| Next.js | componentes `PascalCase.tsx`; tipos `PascalCase`; instâncias e métodos `camelCase` |
| API | RESTful versionado: `GET /api/v1/projects` |
| Estrutura | backend em `api/ core/ models/ schemas/ services/ db/`; nada de lógica no `main.py` |
| Frontend | App Router, pastas por feature; UI em `components/ui`; dados via TanStack Query; validação com Zod |

**Lógica de negócio vive em `services/`.** Endpoint só orquestra. O Smart Core, a integração de IA e a precificação são serviços puros e testáveis isoladamente.

## Art. 6 — Acessibilidade AA é critério de aceite, não melhoria futura

- Contraste mínimo 4.5:1 para texto normal e 3:1 para elementos gráficos, **nos dois temas**.
- Todo `<label>` vinculado por `htmlFor`/`id`. Todo input com nome acessível.
- Tudo que é clicável é focável e visível ao foco. Proibido `tabIndex={-1}` em controle interativo e proibido esconder ação só com `opacity-0 group-hover` sem `focus-within`.
- `<html lang="pt-BR">`.

Um arquiteto trabalhando 8h por dia numa tela é um usuário de acessibilidade mesmo sem se declarar como tal.

## Art. 7 — Cor mora no token, não no componente

Nenhuma cor literal em classe utilitária (`bg-[#008080]`, `bg-emerald-600`, `text-amber-600`). Tudo referencia variável semântica do tema (`--primary`, `--success`, `--destructive`, `--warning`).

A identidade visual **vai mudar** — é ação em aberto e o próprio Thiago assumiu refazer logo e identidade. Cor espalhada em classe estática transforma o rebranding numa varredura manual de dias.

## Art. 8 — A marca é "Arq Smart"

Grafia oficial: **Arq Smart** — duas palavras, com Q. Zero ocorrência de `ArchSmart`, `Ark Smart` ou `Ecowe` em código, copy, e-mail, título de página, seed ou comentário.

⚠️ Os documentos jurídicos publicados (Termo de Uso, Política de Privacidade, Termo de Piloto, parecer do Clipper) estão escritos como *ARCHSMART*, com e-mails `@archsmart.com.br`. **A correção é de responsabilidade do Brenno e é dependência externa deste kit** — mas nenhuma tela pode linkar para um e-mail ou nome que não seja o oficial. Se o documento não tiver sido corrigido, a tela espera.

## Art. 9 — Custo de IA é métrica de produto

Toda chamada a LLM registra `account_id`, `model_name`, `token_count`, `cost_usd`, `latency_ms` e `feature` em `ai_usage_logs` — **na mesma transação da resposta**, não em log assíncrono que pode se perder.

- Todo plano tem cota, com *soft limit* (avisa em 80%) e *hard limit* (bloqueia só a IA, nunca o produto inteiro).
- Nenhuma feature de IA vai a produção sem estimativa de custo por uso documentada na spec.
- A Política de Privacidade afirma ao usuário que os dados enviados à IA **não são usados para treino de modelo público**. O contrato com o provedor de LLM precisa sustentar essa afirmação.

Este é o principal risco de margem do negócio: um usuário pesado pode custar mais do que a assinatura dele.

## Art. 10 — Nada nasce sem instrumentação

Não existe entrega "e depois a gente mede". Toda tela e toda feature definem, na própria spec, quais eventos emitem. Sem os eventos, não está pronto.

Nomenclatura: `objeto_verbo_no_passado` em `snake_case` (`project_created`, `budget_exported`). Toda propriedade em `snake_case`.

Na reescrita isso é ainda mais importante: **a instrumentação entra junto com a tela**, não depois. Instrumentar código pronto é o dobro do trabalho e sempre fica pela metade.

## Art. 11 — Compliance do Web Clipper (4 diretrizes obrigatórias)

Vindas do Parecer Técnico-Jurídico nº 01/2026. Não são recomendações — são a condição de legalidade da feature que sustenta o moat.

1. **Isolamento de tenant** — produto capturado visível apenas para o `account_id` que capturou. Proibido publicar automaticamente em catálogo global aberto.
2. **Atribuição obrigatória da fonte** — o `source_url` da loja original aparece no card, na prancha e no orçamento exportado. Sempre.
3. **Canal de takedown** — endereço de compliance visível e fluxo de remoção rápida a pedido de lojista.
4. **Gatilho por ação humana** — a captura é sempre iniciada por clique do usuário na extensão. **Proibido scraper automatizado em lote no backend**, em qualquer circunstância.

## Art. 12 — Direitos do titular são feature, não papel

Somos **Controladores** dos dados do arquiteto e **Operadores** dos dados dos clientes finais dele. Isso obriga o produto a oferecer, funcionando:

- **Exportar** todos os dados da conta em formato aberto.
- **Excluir** a conta e os dados, com prazo e confirmação.
- Retificar dado cadastral.
- Registrar o aceite de cada documento legal, com versão e data (`legal_acceptances`).

Escrever isso na política e não implementar no produto é pior do que não escrever.

## Art. 13 — Documentação é entrega, não sobra

Toda tela reescrita e toda feature nova entregam, junto com o código:

- **Doc de dev** (`/docs/dev/`) — como o módulo funciona, decisões, contratos de API, gotchas. Escrita para quem entrar no projeto daqui a um ano sem ninguém para perguntar.
- **Doc de usuário** (`/docs/user/`) — como se faz a tarefa, na linguagem do arquiteto.

PR sem doc correspondente não é *done*. Hoje há um dev que sabe tudo; a documentação é o que impede que isso vire o gargalo do negócio.

## Art. 14 — Simples primeiro, medido sempre

- Infraestrutura do beta: **Vercel + Render + Supabase**, decidido. AWS só perto da aquisição de clientes, e nunca durante o beta.
- Lançamento com **um único plano**. Diferenciação Solo/Pro/Studio vem depois.
- Sem plano anual, sem NFS-e no lançamento.
- Preferir sempre a solução mais simples que resolve o problema **medido**. Não há usuário pagante — over-engineering aqui é dívida sem receita.

## Art. 15 — Spec antes de código; escopo do beta é congelado

- Toda tela e toda feature têm spec antes da primeira linha de código.
- A partir do congelamento do escopo do beta, nada entra. Ideia nova vira item de backlog com data.
- Bug `P0` (segurança, perda de dado, bloqueio do fluxo principal) é a única exceção — e ainda assim vira spec curta antes do fix.

---

## Anexo A — Definition of Ready

Um card só entra em desenvolvimento quando:

- [ ] A spec existe e não tem `[DECISÃO PENDENTE]` que bloqueie esta tarefa.
- [ ] O desenho contempla os **5 estados**: Padrão, Hover/Foco, Carregando, Erro e Vazio.
- [ ] Responsividade especificada para **1440px** e **390px**.
- [ ] Tokens de cor e tipografia definidos (nada de cor solta).
- [ ] Eventos de telemetria da tela listados.
- [ ] Critério de aceite escrito e verificável por outra pessoa.

## Anexo B — Definition of Done

- [ ] Atende à spec, incluindo todos os critérios de aceite.
- [ ] Não viola nenhum artigo desta constitution.
- [ ] Query nova filtrada por `account_id` + teste de isolamento (Art. 1).
- [ ] Nenhuma cor, URL, ID ou limite literal introduzido (Art. 3, 4, 7).
- [ ] Os 5 estados implementados — não só o caminho feliz.
- [ ] Testado em mobile real (≥390px) e desktop (1440px).
- [ ] Contraste e navegação por teclado verificados (Art. 6).
- [ ] Eventos de telemetria emitindo (Art. 10).
- [ ] Textos em pt-BR com a terminologia do glossário.
- [ ] Migração Alembic versionada, se houve mudança de schema.
- [ ] **Doc de dev e, quando a tela é de usuário, doc de usuário escritas** (Art. 13).
