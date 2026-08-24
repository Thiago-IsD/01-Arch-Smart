# Spec 013 — Onboarding e documentação de usuário

| Campo | Valor |
|---|---|
| **Onda** | 3 |
| **Prioridade** | 5 |
| **Esforço** | M (1 semana) |
| **Responsável** | Thiago (produto) · Giovanna (conteúdo) |
| **Cobre** | `EPIC-ONB`, `GIO-2`, `EPIC-HELP`, `EPIC-SUP` |

---

## 1. Problema

15 arquitetos entram no beta com onboarding 1:1 conduzido pela Giovanna. Isso funciona para 15 e não funciona para 150. **Se o produto só ativa com uma sócia ao telefone, o beta mede a Giovanna, não o produto.**

Há também um problema estrutural de produto vertical: o Arq Smart só entrega valor **depois** que existe biblioteca, projeto e ambiente com área. Um usuário novo abre o app e encontra três telas vazias. É o momento de maior abandono.

A própria Giovanna pediu em 21/07: *"deixar um vídeo com tutorial e uma flag no início pra pessoa aprender sozinha"*.

## 2. Resultado esperado

Um arquiteto que nunca viu o produto chega ao primeiro orçamento exportado em menos de 30 minutos, **sozinho**. E quando trava às 22h de um sábado, encontra a resposta sem ninguém.

## 3. Escopo

**Dentro:**
- Checklist de primeiros passos, persistente.
- Vídeo tutorial curto (≤4 min) + flag de primeiro acesso.
- Projeto de exemplo pré-populado, removível.
- Biblioteca inicial semeada.
- Central de ajuda em `/ajuda`.
- Canal de suporte por e-mail com SLA.
- Kit do beta-tester (conteúdo, não código).

**Fora:**
- Tour interativo com overlays — caro e geralmente ignorado; o checklist resolve melhor.
- Chatbot — depois, se o volume justificar.
- Onboarding por segmento.

## 4. Primeiro acesso

```
Dado o primeiro login
Então aparece uma vez um modal com o vídeo (≤4 min) e dois caminhos:
     "Explorar com projeto de exemplo" e "Começar do zero"
```

## 5. Checklist de primeiros passos

Widget fixo no topo do dashboard até 100% concluído:

- [ ] Assistir ao tutorial (2 min)
- [ ] Instalar o Web Clipper
- [ ] Adicionar 5 produtos à biblioteca
- [ ] Criar seu primeiro projeto
- [ ] Criar um ambiente com a área em m²
- [ ] Adicionar produtos ao ambiente
- [ ] **Exportar seu primeiro orçamento** ← 🎯 Ação de Valor

Cada item mostra progresso real ("3 de 5 produtos").

Ordem deliberada: **Web Clipper antes de tudo.** É a entrada de dado que alimenta o moat e a etapa que o usuário mais adia se não for empurrada cedo.

## 6. Projeto de exemplo

"Apartamento Modelo — 72 m²" com 3 ambientes (sala, cozinha, banheiro), itens vinculados e quantidades já calculadas. Marcado visualmente como exemplo, com botão de remover.

Existe para o usuário ver o produto **funcionando** antes de investir 20 minutos alimentando-o. É a resposta mais barata ao problema da tela vazia.

⚠️ Criado **na conta do próprio usuário**, com o `account_id` dele (Art. 1). Nunca conta compartilhada — foi assim que nasceu o bug do código antigo.

## 7. Biblioteca semeada

~30 itens de categorias comuns (porcelanato, tinta, louça, metais, iluminação) com preço, rendimento e imagem. Apagáveis em bloco.

`[DECISÃO PENDENTE]` Usar marca e imagem de fornecedor real levanta a mesma questão de direito de imagem que o parecer trata. Enquanto não houver posição do Brenno, semear com **dados genéricos** ("Porcelanato acetinado 60×60", sem marca) e imagem própria ou de banco livre.

## 8. Central de ajuda

Renderizada em `/ajuda` a partir do Markdown de `/docs/user/` (spec 004) — a doc fica junto do código e envelhece menos.

- Busca por texto.
- Artigos organizados por **tarefa**, não por tela.
- Link contextual: cada `EmptyState` aponta para o artigo relevante.
- Artigos obrigatórios antes do beta: criar conta · instalar o Clipper · capturar produtos · criar ambientes e áreas · como as quantidades são calculadas · montar um orçamento · enviar pelo WhatsApp · exportar seus dados · encerrar sua conta.

## 9. Suporte

Início mínimo: **e-mail com SLA de 48h**, respondido pelos sócios em rodízio. Chatbot e biblioteca de vídeos ficam para quando o volume justificar — com 15 usuários, e-mail resolve e ensina mais sobre o produto do que qualquer automação.

## 10. Dados

```sql
ALTER TABLE users
  ADD COLUMN onboarding_state JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE projects ADD COLUMN is_sample BOOLEAN DEFAULT FALSE;
```

`onboarding_state` em JSONB porque a lista de passos vai mudar, e não vale uma migração por passo.

## 11. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `onboarding_started` | cliente | — |
| `onboarding_step_completed` | cliente | `step`, `step_index`, `minutes_since_signup` |
| `onboarding_completed` | cliente | `duration_minutes`, `steps_completed`, `skipped` |
| `tutorial_video_watched` | cliente | `percent_watched` |
| `sample_project_opened` / `_removed` | cliente | — |
| `help_article_viewed` | cliente | `article`, `from_screen` |
| `help_searched` | cliente | `query_has_results` |

**O passo em que as pessoas param é a informação mais valiosa da primeira semana do beta.** E `help_searched` com `query_has_results = false` é a lista de artigos que faltam escrever.

## 12. Kit do beta-tester (não é código)

| Item | Responsável |
|---|---|
| E-mail de boas-vindas com credenciais e link do vídeo | Giovanna |
| Roteiro do onboarding 1:1 (30 min) | Giovanna |
| Grupo de WhatsApp dos testers | Giovanna |
| Canal de suporte por e-mail, SLA 48h | grupo |
| Formulário de avaliação (7 perguntas do Go/No-Go) | Giovanna |
| Termo de Piloto aceito por cada tester | Brenno + spec 012 |

## 13. Critérios de aceite

- [ ] Modal de boas-vindas com vídeo, uma vez só.
- [ ] Checklist de 7 passos com progresso real, persistente entre sessões.
- [ ] Projeto de exemplo criado na conta do próprio usuário e removível.
- [ ] Biblioteca semeada com ≥30 itens, apagável em bloco.
- [ ] `/ajuda` no ar, com busca e os artigos obrigatórios.
- [ ] Todo `EmptyState` linka para o artigo relevante.
- [ ] **3 pessoas de fora do time completam do login ao export em <30 min, sem ajuda.**
- [ ] Eventos de onboarding chegando.
- [ ] Vídeo gravado, hospedado e legendado.
- [ ] Canal de e-mail testado.

## 14. Riscos

- **Risco:** o vídeo virar produção de uma semana. → Timebox: gravação de tela com narração, 4 min, sem edição elaborada. Refazer depois do beta com o que se aprendeu.
- **Risco:** o 1:1 mascarar problemas do produto. → **A Giovanna não intervém nos 10 primeiros minutos.** Observa e anota onde a pessoa trava. Esses 10 minutos valem mais que o resto da reunião — e é exatamente o que o session replay também captura.
- **Risco:** biblioteca semeada com marca de terceiro sem posição jurídica. → Dados genéricos até haver posição.
