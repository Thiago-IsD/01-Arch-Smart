# Visão de Produto — Arq Smart

**Versão 2.0 — 23/08/2026** · Fontes: `README.md` do projeto, deck GTM, atas 14/07 a 18/08, doc da Giovanna, parecer jurídico.

---

## 1. Uma frase

**Arq Smart unifica especificação de materiais, orçamento e aprovação em um único fluxo, para devolver ao arquiteto o tempo de criar.**

Não vendemos software. Vendemos horas de volta e orçamento que não erra.

## 2. Para quem (ICP)

Arquiteto residencial brasileiro — autônomo ou escritório pequeno (1–5 pessoas).

| Sinal | Valor |
|---|---|
| Projetos simultâneos | 2 a 5 |
| Especificação de materiais | recorrente, é parte central do trabalho |
| Ferramenta atual | planilha própria + WhatsApp + Canva + Drive |
| Abertura digital | alta; já paga por Canva/Drive |
| Dor que reconhece na hora | "perco meu domingo montando orçamento" |

## 3. Jobs to be done

1. **"Preciso orçar esse projeto sem passar o fim de semana na planilha."** — job principal. É onde o produto ganha ou perde.
2. **"Preciso mandar isso pro cliente de um jeito que ele entenda e aprove."** — export.
3. **"Preciso saber se esse projeto deu lucro."** — financeiro por projeto.
4. **"Preciso não perder o lead que me chamou semana passada."** — comercial.
5. **"Preciso que minha equipe execute sem ver meu financeiro."** — equipe e permissões.

Os jobs 4 e 5 vieram de benchmark (SIARQ, Monsi), não de dor observada nos nossos usuários. Ficam nas ondas 4 e 7, e o 4 só depois de validado com beta-testers.

## 4. Proposta de valor e moat

O diferencial não é "ter IA". É **inteligência ativa** sobre dados que só nós temos:

| Ativo | Por que defende |
|---|---|
| **Catálogo preenchido por IA** (Web Clipper) | quanto mais arquitetos capturam, melhor a normalização; concorrente novo começa do zero |
| **DNA do Ambiente** | ambiente reutilizável entre projetos; lock-in de dado, não de contrato |
| **Calculadora de insumos** (área × margem de quebra ÷ rendimento) | tira o erro humano do orçamento |
| **Calculadora de precificação** (Padrão Milar) | precifica o *serviço* do arquiteto — ninguém no mercado brasileiro faz isso integrado |

⚠️ **Restrição jurídica ao moat:** o parecer nº 01/2026 proíbe republicar em catálogo global aberto o acervo capturado por um arquiteto. O dado acumulado só pode virar produto na forma **agregada e anonimizada** (preço médio por categoria, rendimento típico, tendência de fornecedor) — nunca republicando imagem ou ficha de terceiro para outro usuário. Isso não mata a tese; muda o desenho dela.

## 4b. Concorrentes

| Concorrente | Origem |
|---|---|
| **Programa** | internacional — referência em especificação FF&E |
| **Mydoma Studio** | EUA — gestão completa de escritório de design |
| **Spec.in** | 🇧🇷 principal concorrente nacional |
| **Houzz Pro** | global |

O benchmark competitivo de 18/06/2026 comparou o produto com os quatro; as recomendações já foram implementadas. O relatório está em `04. Produto e Tecnologia/ux_ui_benchmark_report.docx` — este kit não replica o conteúdo dele.

## 5. Módulos

| Módulo | Estado | Onda |
|---|---|---|
| Autenticação e conta | reescrever | 2 (spec 005) |
| Dashboard | reescrever | 2 (006) |
| Projetos e Ambientes (DNA) | reescrever | 2 (007) |
| Biblioteca + Web Clipper + preenchimento por IA | reescrever | 2 (008) |
| Orçamento e exportação | reescrever | 2 (009) |
| Financeiro (Wallet) | reescrever, depois evoluir | 2 (010) → 4 (014) |
| Apresentações + Portal do cliente | reescrever, escopo reduzido | 2 (011) |
| Compliance e LGPD | construir | 3 (012) |
| Onboarding | construir | 3 (013) |
| Calculadora de Precificação | construir | 4 (015) |
| Contatos e Comercial | construir | 4 (016) |
| Templates de projeto | construir | 4 (017) |
| Admin Master | construir | 5 (018) |
| Billing (Asaas) | construir | 6 (019) |
| Equipe e RBAC | construir | 7 (020) |

## 6. Não-objetivos

- ❌ Não seremos ferramenta de projeto/CAD/3D.
- ❌ Não seremos editor de apresentação de propósito geral. Não competimos com Canva.
- ❌ Não faremos gestão de obra completa.
- ❌ Não faremos marketplace nem transacionaremos a compra de material.
- ❌ Não faremos app mobile nativo. Web responsiva resolve.
- ❌ Não faremos scraping automatizado de catálogos (proibido pelo Art. 11 da constitution).
- ❌ Não atenderemos arquitetura corporativa de grande porte.

## 7. Escopo do módulo Apresentações — decidido

O roadmap pedia Brand Kit + galeria de modelos editáveis (`MOD-12`, `MOD-13`). A Giovanna, arquiteta do time e voz do cliente, escreveu o contrário:

> *"A apresentação deve ser criada pelo próprio arquiteto na plataforma que ele já está acostumado. O interessante é facilitar o orçamento e conseguir exportar esse orçamento em wpp, pdf ou excel."*
> *"Não precisa ter avaliação do cliente porque a apresentação acontece e as alterações devem ser ao vivo."*

**Direção adotada: export primeiro, editor não.** Competir com Canva em editor visual, com 4 sócios e orçamento zero, contra um usuário profissionalmente treinado em estética, é uma guerra perdida antes de começar.

Consequências: a spec 009 investe pesado em exportação (WhatsApp, PDF, Excel, com link de compra e observações). A spec 011 reescreve Apresentações e Portal do Cliente em escopo reduzido. Brand Kit entra mínimo — logo e cor aplicados ao **orçamento**. Galeria de modelos sai do horizonte visível.

**Anti-requisitos** — registrados para não voltarem por inércia:
- ❌ Avaliação/aprovação do cliente sobre a apresentação dentro do produto (`GIO-8`). ⚠️ Se existir hoje, é a **única exceção deliberada à paridade** da reescrita — ver spec 011 §1b.
- ❌ Editor de slides.
- ❌ Galeria de modelos de apresentação editáveis.

## 8. Modelo de receita (impacto em produto)

Decidido em 18/08:

- **Um único plano no lançamento.** Solo/Pro/Studio ficam para depois.
- **Sem plano anual** — só recorrência mensal simples. O motivo foi a complexidade de reembolso em cancelamento antecipado.
- **Sem emissão de NFS-e** inicialmente.
- Precificação ancorada em **limite de projetos simultâneos** (sugestão inicial: 2 no plano básico).
- Slots avulsos (pay-per-project) continuam no modelo.
- Estados de assinatura: `BETA`, `ACTIVE`, `READ_ONLY` — conforme o Termo de Uso publicado.

⚠️ **Reforma tributária:** IBS e CBS substituem cinco impostos a partir de janeiro, e o imposto passa a ser somado **por fora** do preço em vez de embutido. Isso muda como o preço é exibido e cobrado. A spec 019 precisa suportar preço-base + tributo destacado, mesmo que o valor do tributo seja zero no início.

## 9. Glossário e terminologia (obrigatório na UI)

| ❌ Não usar | ✅ Usar |
|---|---|
| "Normalizar" | **"Preencher"** |
| "Builder" | **"Arquivo"** |
| "ArchSmart", "Ark Smart" | **"Arq Smart"** |
| "Assistente Ecowe" | **"Assistente Arq Smart"** |
| "Entrada" (financeiro) | **"Receita"** |

**Serviços oferecidos** (ajuste pedido em 21/07):
- ✅ Incluir: Projeto arquitetônico + interiores · Consultoria de Interiores · Consultoria Imobiliária
- ❌ Remover: Consultoria Express
- ℹ️ Gestão de obra pode ser "gestão" ou "assessoria de execução", embutida ou não numa proposta de projeto.

## 10. Princípio de design

**O arquiteto é criativo e treinado em estética. Ele não vai perdoar interface feia, e não vai usar ferramenta que o engesse.**

1. A interface precisa ser bonita — não é cosmético, é retenção.
2. Onde ele já tem uma ferramenta que ama (Canva, Drive), **integre ou exporte, não substitua**.
