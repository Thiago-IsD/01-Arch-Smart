# Playbook de Reescrita de Tela

> Este documento existe para não repetir 7 vezes a mesma coisa.
> As specs 005 a 011 descrevem **o que é específico de cada tela**. Tudo que é comum a todas está aqui.
> Nenhuma tela reescrita é aceita sem cumprir este playbook integralmente.

**Versão 1.0 — 23/08/2026**

---

## Por que estamos reescrevendo

A plataforma está lenta. A auditoria de UX/UI e o benchmark competitivo de junho **já foram implementados**. O que não se resolveu com correção pontual foi a performance.

A reescrita não é para "deixar mais bonito". É para sair com uma base que (a) é rápida por construção, (b) é segura por construção, (c) se mede sozinha, e (d) alguém que não seja o Thiago consegue manter.

**Duas advertências que decorrem disso:**

**1. Correção aplicada não viaja para código novo.** Os achados da auditoria foram corrigidos no código atual, mas as *classes* de defeito voltam se nada as impedir — porque quem escreve é a mesma pessoa, com os mesmos hábitos, sob a mesma pressa. Por isso a Onda 1 transforma as mais caras em erro de build (cinco `grep` no CI, spec 001) ou em componente que não deixa errar (design system, spec 002).

**2. Paridade vale para tudo, sem lista de exceções.** Tudo que o produto faz hoje continua funcionando depois — inclusive o que veio das melhorias de junho. Não há inventário de "features que importam mais": a única exceção deliberada é `GIO-8`, registrada na spec 011.

O inventário do que existe **sai do código**, na doc de módulo do passo 6 — não de relatórios antigos, que já não descrevem o que foi de fato implementado.

Reescrever sem esses objetivos escritos produz o mesmo código de novo, com bugs diferentes — e sem as funcionalidades que já custaram trabalho.

---

## As 7 telas, em ordem de execução

| # | Spec | Tela / fluxo | Por que nesta ordem |
|---|---|---|---|
| 1 | 005 | Autenticação e conta | tudo depende da sessão e do `account_id` correto |
| 2 | 006 | Dashboard | é a casa; define o shell, a navegação e o padrão de carregamento |
| 3 | 007 | Projetos e Ambientes (DNA) | o núcleo do modelo de dados |
| 4 | 008 | Biblioteca e Web Clipper | a entrada de dado do moat |
| 5 | 009 | Orçamento e Exportação | onde o valor sai do produto — **é a Ação de Valor** |
| 6 | 010 | Financeiro (Wallet) | fora do caminho crítico do beta, mas já existe |
| 7 | 011 | Apresentações e Portal do Cliente | o mais sujeito a mudar de escopo |

Ao terminar a tela 5 (orçamento e export), **o fluxo principal do beta está de pé**. As telas 6 e 7 podem, se o calendário apertar, entrar depois do início do beta.

---

## O que "reescrever uma tela" significa aqui

Para cada tela, sete coisas acontecem juntas. Não são fases — são o mesmo trabalho.

### 1. Segurança por construção

- Toda query filtrada por `account_id` resolvido no servidor.
- Nenhum recurso acessível por link público sem sessão ou token assinado.
- Nenhum limite de plano decidido no front.
- Teste de isolamento entre contas escrito **junto** com o endpoint.

### 2. Performance por construção

Orçamento por tela, verificado antes do merge:

| Métrica | Alvo |
|---|---|
| LCP | < 2,0 s no P75, em 4G throttled |
| INP | < 200 ms no P75 |
| CLS | < 0,1 |
| Queries por carregamento | < 8 |
| Resposta da API | < 400 ms no P95 |
| JS da rota | < 200 KB gzip |

Regras que evitam a maior parte dos problemas antes de acontecerem:

- Server Components por padrão; `"use client"` só onde há interatividade real.
- `selectinload`/`joinedload` em toda relação carregada em lista — N+1 é o defeito mais comum e o mais caro.
- Índice criado junto com toda coluna usada em filtro ou ordenação.
- Paginação em toda lista que pode passar de 50 itens. Sem exceção.
- `next/image` em toda imagem, com `sizes` correto.
- Skeleton no lugar de spinner de tela cheia.

### 3. Gravação da jornada do usuário

Duas camadas, complementares:

**Eventos** — o que aconteceu, contável e comparável. Cada tela declara os seus na spec. Eventos de fato de negócio saem do **servidor**; eventos de interação saem do cliente.

**Gravação de sessão (session replay)** — o *como*, que nenhum evento captura: onde a pessoa hesitou, o que ela clicou achando que era botão, onde ela leu duas vezes. Numa reescrita com 15 beta-testers, isso vale mais que qualquer reunião de feedback.

⚠️ **Obrigatório em toda tela com dado sensível:** mascarar valores financeiros, dados de cliente final, documento e senha. O replay não pode virar um vazamento de dado de terceiro — somos Operadores desses dados (Art. 12). Marcar com `data-private` e validar o mascaramento na revisão.

Além disso, toda tela registra:
- `screen_viewed` com `screen`, `load_ms`, `is_empty`
- `error_shown` com `error_code`, `screen`
- Tempo até a primeira ação útil da tela

### 4. Os 5 estados

Nenhuma tela é aceita com só o caminho feliz:

| Estado | O que precisa existir |
|---|---|
| **Padrão** | o conteúdo, com dados reais e volume realista |
| **Carregando** | skeleton com a forma do conteúdo, nunca spinner bloqueante |
| **Vazio** | explica o que é a tela, dá a ação primária e ensina o próximo passo |
| **Erro** | diz o que houve em português, oferece tentar de novo, não perde o que o usuário digitou |
| **Foco/Hover** | tudo clicável é focável e visível ao Tab |

O estado vazio é o mais negligenciado e o mais decisivo: é o que o beta-tester vê no primeiro minuto.

### 5. Acessibilidade AA

Contraste ≥4.5:1 nos dois temas · `htmlFor`/`id` em todo campo · navegação completa por teclado · `aria-label` onde o rótulo é visual · foco visível · `lang="pt-BR"`.

Checagem obrigatória antes do merge: axe DevTools sem violação, Lighthouse Accessibility ≥95.

### 6. Documentação de dev

Um arquivo em `/docs/dev/modulos/<modulo>.md` por tela, seguindo `docs/template-doc-modulo.md`. Precisa responder, sem ninguém para perguntar:

- O que essa tela faz e para quem.
- Quais endpoints ela consome e o contrato de cada um.
- Quais tabelas ela toca.
- Quais decisões não-óbvias foram tomadas e por quê.
- O que quebra se você mexer aqui.

### 7. Documentação de usuário

Um artigo em `/docs/user/` por tarefa que a tela permite — não por tela. O arquiteto não procura "Dashboard", ele procura "como monto um orçamento". Escrito na linguagem dele, com o glossário do produto.

---

## Ordem de trabalho dentro de uma tela

1. Ler a spec da tela e o `docs/template-doc-modulo.md`.
2. Modelar os dados e a API primeiro. Escrever o teste de isolamento.
3. Construir o serviço de negócio, puro e testável.
4. Construir a tela em Server Component; adicionar cliente só onde precisa.
5. Implementar os 5 estados **antes** de refinar o visual.
6. Instrumentar (eventos + mascaramento de replay).
7. Medir contra o orçamento de performance. Corrigir.
8. Passar axe + Lighthouse.
9. Escrever as duas documentações.
10. Revisar contra o Anexo B da constitution.

O passo 5 vir antes do 10 é deliberado: quem deixa estado vazio e erro para o fim, não faz.

---

## O que **não** fazer nesta reescrita

- ❌ Não adicionar funcionalidade nova. Reescrita é paridade + qualidade. Funcionalidade nova tem onda própria (specs 014–017).
- ❌ Não trocar de stack. Next.js + FastAPI + PostgreSQL, e Vercel/Render/Supabase, permanecem (Art. 14).
- ❌ Não migrar para AWS. Fica para depois da aquisição de clientes.
- ❌ Não construir abstração para um segundo caso de uso que ainda não existe.
- ❌ Não reescrever tudo em paralelo. Uma tela por vez, mergeada e medida, antes da próxima.

O último é o que mais falha na prática. Sete telas abertas ao mesmo tempo viram sete telas pela metade na semana do beta.

---

## Definition of Done de uma tela reescrita

- [ ] **Paridade funcional** com a tela antiga — nada que funcionava parou de funcionar (única exceção: `GIO-8`, spec 011)
- [ ] Nenhuma classe de defeito conhecida reintroduzida — CI e design system verdes
- [ ] Teste de isolamento entre contas passando
- [ ] Orçamento de performance atingido, medido em 4G throttled com dados realistas
- [ ] Os 5 estados implementados
- [ ] axe sem violação · Lighthouse A11y ≥95
- [ ] Eventos emitindo, replay com dado sensível mascarado
- [ ] `docs/dev/modulos/<modulo>.md` escrito
- [ ] Artigo(s) de `docs/user/` escritos
- [ ] Nenhuma cor, URL, ID ou limite literal
- [ ] Testado em 390px e 1440px
