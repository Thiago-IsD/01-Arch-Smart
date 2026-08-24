# Spec 006 — Reescrita: Dashboard e shell da aplicação

| Campo | Valor |
|---|---|
| **Onda** | 2 · tela 2 de 7 |
| **Prioridade** | 5 |
| **Esforço** | M (4 dias) |
| **Cobre** | `RW-02` · guardas de regressão: `UX-01`, `UX-02`, `UX-05`, `UI-03`, `UI-05`, grid <390px |
| **Playbook** | `memory/playbook-reescrita.md` |

---

## 1. Por que agora

O dashboard não é só uma tela: ele carrega o **shell** — sidebar, header, breadcrumbs, padrão de carregamento, tratamento de erro global e a instrumentação automática de `screen_viewed`. Tudo que as cinco telas seguintes herdam nasce aqui.

Fazer o shell certo agora significa cinco telas mais rápidas depois. Fazer errado significa cinco telas com o mesmo defeito.

## 2. Classes de defeito a não repetir

Todos os itens abaixo **já foram corrigidos** no código atual. Estão aqui porque a correção não viaja para código novo — o hábito que os produziu, sim.

| Achado | Defeito original |
|---|---|
| `UX-01` | o `BreadcrumbProvider` existia mas o header mostrava só "Bem-vindo à Arch Smart" e a data. Em fluxos profundos, o usuário se perdia |
| `UX-02` | carregamento inicial bloqueava a tela inteira com spinner de 70vh |
| `UX-05` | `<a>` nativa causando reload completo |
| `UI-03` | `xl:pr-32` deformando o layout em telas grandes |
| `UI-05` | `<img>` nativa gerando layout shift |
| — | grid de produtos travado em `grid-cols-2`, espremido abaixo de 360px |

## 3. Escopo

**Dentro:**
- Shell: sidebar, header, breadcrumbs dinâmicos, área de conteúdo.
- Dashboard: métricas do escritório, projetos recentes, capturas recentes, atalhos.
- Instrumentação automática de tela.
- `ErrorBoundary` global.
- Estados vazios de primeiro acesso.

**Fora:**
- Widget de tarefas (`MOD-11`) — Onda 4.
- Checklist de onboarding — spec 013 (mas o shell reserva o espaço).
- Notificações.

## 4. Comportamento

### Breadcrumbs dinâmicos

```
Dado que o usuário está em /projetos/{id}/ambientes/{id}
Então o header mostra: Projetos › Apartamento 102 › Sala de estar
E cada nível é um link funcional
```

Lidos da rota via `usePathname`, com resolução de nome por segmento. Sem breadcrumb, o produto tem três níveis de profundidade e nenhuma pista de onde se está.

### Carregamento

```
Dado que o dashboard está carregando
Então cada bloco mostra um Skeleton com a forma do conteúdo dele
E os blocos que já carregaram são utilizáveis
```

Nunca bloquear a tela inteira. Blocos independentes carregam independentemente — o usuário começa a agir antes de tudo terminar.

### Estado de primeiro acesso

O dashboard de quem acabou de entrar está **vazio**. É o momento de maior abandono num produto vertical.

```
Dado um usuário sem projetos e sem itens na biblioteca
Então o dashboard mostra o caminho: instalar o Clipper → capturar produtos → criar projeto
E não mostra cards de métrica zerados
```

Card de métrica zerado comunica "esse produto não tem nada". O `EmptyState` comunica "faça isto agora".

## 5. Conteúdo do dashboard

| Bloco | Conteúdo | Vazio |
|---|---|---|
| Resumo | projetos ativos (com limite do plano), ambientes, itens na biblioteca | oculto |
| Projetos recentes | 5 últimos, com progresso | `EmptyState` "Crie seu primeiro projeto" |
| Capturas recentes | 8 últimos itens, com foto e fonte | `EmptyState` "Instale o Web Clipper" |
| Atalhos | novo projeto, nova captura, novo orçamento | sempre visível |

O contador de projetos exibe o limite vindo dos entitlements (`3 de 5 projetos`) — **nunca** um número escrito no código (`UX-03`).

## 6. Performance

Orçamento do playbook, com atenção a dois pontos que quebravam antes:

- Dashboard agrega várias fontes. Usar **um** endpoint `GET /api/v1/dashboard` que devolve tudo, em vez de 5 chamadas em cascata.
- Imagens de produto com `next/image`, `sizes` correto e `priority` só na primeira dobra (`UI-05`).

## 7. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `screen_viewed` | cliente | `screen`, `load_ms`, `is_empty` |
| `dashboard_shortcut_clicked` | cliente | `shortcut` |
| `rage_click_detected` | cliente | `screen`, `element` |
| `error_shown` | cliente | `error_code`, `screen` |

O shell emite `screen_viewed` para **todas** as telas automaticamente. Nenhuma tela seguinte precisa lembrar disso.

## 8. Critérios de aceite

- [ ] Playbook cumprido integralmente.
- [ ] Breadcrumbs dinâmicos funcionando em todos os níveis, com links reais.
- [ ] Nenhum spinner bloqueante; blocos carregam de forma independente.
- [ ] Estado de primeiro acesso mostra caminho de ação, não métricas zeradas.
- [ ] Contador de projetos vem dos entitlements.
- [ ] Sidebar navegável e utilizável por teclado; em mobile, menu-gaveta.
- [ ] Paddings simétricos em 1440px (`UI-03` resolvido).
- [ ] Grid legível em 360px.
- [ ] Toda imagem via `next/image`; CLS < 0,1.
- [ ] Nenhuma `<a>` nativa para rota interna.
- [ ] `screen_viewed` emitindo automaticamente em todas as rotas.
- [ ] `docs/dev/modulos/dashboard.md` escrita.

## 9. Riscos

- **Risco:** o dashboard virar vitrine de gráficos que ninguém usa. → O dashboard é um **ponto de partida**, não um relatório. Se um bloco não leva a uma ação, ele não deveria estar ali.
- **Risco:** o shell acumular responsabilidade e virar o arquivo mais complexo do projeto (foi o que houve com `AppShell.tsx`). → Shell faz layout, navegação e instrumentação. Regra de negócio nele é bug.
