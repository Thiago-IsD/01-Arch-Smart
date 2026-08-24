# Spec 004 — Estrutura de documentação (dev e usuário)

| Campo | Valor |
|---|---|
| **Onda** | 1 |
| **Prioridade** | 4 |
| **Esforço** | P (2 dias para a estrutura; o conteúdo vem com cada tela) |
| **Responsável** | Thiago (dev) · Giovanna (usuário) |
| **Cobre** | `EPIC-DOCS` |

---

## 1. Problema

Hoje existe **uma** pessoa que sabe como a plataforma funciona. Ela é o dev principal, tem emprego, e mencionou na ata de 11/08 possível mudança na carga horária presencial.

Isso é o maior risco não-financeiro do projeto. Não porque alguém vá embora, mas porque conhecimento concentrado transforma toda decisão técnica num gargalo — e impede que o Brenno, que já se comprometeu a codificar junto, contribua sem interromper.

Do outro lado, o beta vai receber 15 arquitetos que a Giovanna vai atender 1:1. Isso funciona para 15 e não funciona para 150. Documentação de usuário é o que permite o produto crescer sem crescer o atendimento.

A reescrita é a única janela em que documentar é barato: o código está sendo escrito **agora**, com o raciocínio fresco. Documentar depois é arqueologia.

## 2. Resultado esperado

**Dev:** alguém que chega ao projeto em 2027, sem ninguém para perguntar, consegue subir o ambiente, entender a arquitetura e mexer num módulo com segurança.

**Usuário:** um arquiteto que travou às 22h de um sábado encontra a resposta sozinho.

## 3. Escopo

**Dentro:**
- Estrutura de pastas `/docs/dev/` e `/docs/user/`.
- Templates de página de módulo e de artigo de ajuda.
- As páginas fundacionais de dev (arquitetura, ambiente, convenções, ADRs).
- Formato e tom da doc de usuário.
- Regra de manutenção: doc entra no PR.

**Fora:**
- O conteúdo por módulo — vem junto com cada tela da Onda 2.
- Os artigos de ajuda do fluxo principal — spec 013.
- Site público de documentação (por ora, Markdown no repositório basta).

## 4. `/docs/dev/` — para devs futuros

```
docs/dev/
├── README.md                    # por onde começar
├── ambiente.md                  # subir o projeto do zero em <30 min
├── arquitetura.md               # visão geral, camadas, decisões estruturais
├── convencoes.md                # nomenclatura, padrões, o que é proibido e por quê
├── modelo-de-dados.md           # schema comentado, com o porquê de cada relação
├── design-system.md             # tokens, componentes, quando usar cada um
├── dados-coletados.md           # eventos, replay, o que é mascarado (spec 003)
├── deploy.md                    # esteira, ambientes, como reverter
├── decisoes/                    # ADRs — uma decisão por arquivo
│   ├── 0001-manter-vercel-render-supabase.md
│   ├── 0002-reescrita-em-vez-de-refatoracao.md
│   ├── 0003-asaas-como-gateway.md
│   └── ...
└── modulos/                     # uma página por tela reescrita
    ├── autenticacao.md
    ├── dashboard.md
    ├── projetos-ambientes.md
    ├── biblioteca-clipper.md
    ├── orcamento-export.md
    ├── financeiro.md
    └── apresentacoes-portal.md
```

### ADRs (registros de decisão)

Formato curto, uma decisão por arquivo: **contexto · opções · decisão · consequências · data**.

Existem para responder a pergunta que mais custa tempo num projeto herdado: *"por que diabos isso foi feito assim?"* — sem ADR, a resposta é sempre "sei lá, refaz".

Três já existem e devem ser escritas nesta spec, porque as decisões já foram tomadas:
1. **Manter Vercel + Render + Supabase no beta**, adiando AWS (decisão de 18/08).
2. **Reescrever em vez de refatorar** (decisão de 18/08) — com o que se espera ganhar e como será medido.
3. **Asaas como gateway** — com o motivo (PIX e boleto nativos; NFS-e saiu do escopo, e ambos os candidatos aceitam PF).

### Regra de ouro da doc de dev

Escreva para quem **não estava na conversa**. Toda vez que a resposta for "ah, isso foi porque naquela reunião…", isso vira uma linha na doc.

## 5. `/docs/user/` — para o arquiteto

```
docs/user/
├── README.md                     # índice da central de ajuda
├── primeiros-passos/
│   ├── criando-sua-conta.md
│   ├── instalando-o-web-clipper.md
│   └── seu-primeiro-projeto.md
├── biblioteca/
│   ├── capturando-produtos.md
│   ├── adicionando-produtos-manualmente.md
│   └── organizando-por-categoria.md
├── projetos/
│   ├── criando-ambientes-e-areas.md
│   ├── como-as-quantidades-sao-calculadas.md
│   └── margem-de-quebra.md
├── orcamento/
│   ├── montando-um-orcamento.md
│   ├── enviando-pelo-whatsapp.md
│   └── exportando-em-pdf-e-excel.md
├── financeiro/
└── conta/
    ├── exportando-seus-dados.md
    └── encerrando-sua-conta.md
```

### Regras de escrita

**Organize por tarefa, não por tela.** O arquiteto não procura "Dashboard" — procura "como monto um orçamento". Título de artigo é sempre uma tarefa.

**Fale a língua dele.** "Preencher", nunca "normalizar". "Arquivo", nunca "builder". "Receita", nunca "entrada". O glossário está em `product/01-visao-de-produto.md` §9.

**Estrutura fixa de cada artigo:**
1. Uma frase dizendo o que o artigo resolve
2. Passo a passo numerado, com uma ação por passo
3. Captura de tela onde ajudar
4. "E se der errado" — os 2 ou 3 problemas mais comuns
5. Link para o próximo artigo lógico

**Curto.** Se passa de uma tela de rolagem, provavelmente são dois artigos.

`[DECISÃO PENDENTE]` Onde a central de ajuda vive para o usuário final: Markdown renderizado dentro do produto, Notion público, ou ferramenta dedicada. **Recomendação: Markdown no repositório, renderizado em `/ajuda` dentro do produto.** Mantém a doc junto do código (então ela envelhece menos), não custa nada e não adiciona ferramenta. Decidir na spec 013.

## 6. Manutenção

A regra que faz a diferença entre documentação viva e documentação morta:

> **PR que altera comportamento e não altera doc não é aprovado.**

Está no Anexo B da constitution. É a única forma que funciona — documentar em mutirão trimestral nunca acontece.

Complementos baratos:
- Cada página de módulo tem `Última revisão: AAAA-MM-DD` no topo.
- A weekly de segunda inclui um minuto de "alguma doc ficou desatualizada esta semana?".

## 7. Critérios de aceite

- [ ] Estrutura de pastas criada, com `README.md` em cada nível.
- [ ] `docs/dev/ambiente.md` permite subir o projeto do zero em menos de 30 minutos — **testado por alguém que não seja o Thiago** (o Brenno é o teste ideal).
- [ ] `docs/dev/arquitetura.md`, `convencoes.md` e `modelo-de-dados.md` escritas.
- [ ] As 3 ADRs iniciais escritas.
- [ ] `docs/template-doc-modulo.md` e `docs/template-artigo-ajuda.md` prontos.
- [ ] Regra "PR sem doc não mergeia" ativa no checklist de revisão.
- [ ] Decisão de §5 sobre onde a central de ajuda vive registrada.

## 8. Riscos

- **Risco:** documentação vira projeto paralelo e atrasa a reescrita. → Esta spec entrega só a **estrutura** (2 dias). O conteúdo vem com cada tela, como parte do trabalho da tela.
- **Risco:** doc de dev escrita pelo autor fica incompreensível para outro. → `ambiente.md` é validada pelo Brenno subindo o projeto do zero. Se ele travar, a doc está errada.
- **Risco:** doc de usuário escrita pelo dev fica técnica demais. → A doc de usuário é da Giovanna. Ela é a arquiteta e sabe qual palavra o cliente usa.
