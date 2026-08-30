# Spec 009 — Reescrita: Orçamento e Exportação 🎯

| Campo | Valor |
|---|---|
| **Onda** | 2 · tela 5 de 7 — **marco do beta** |
| **Prioridade** | 5 |
| **Esforço** | G (1,5–2 semanas) |
| **Cobre** | `RW-05`, `GIO-4`, `GIO-5`, `JUR-2` + Brand Kit mínimo (`MOD-12` reduzido) |
| **Playbook** | `memory/playbook-reescrita.md` |

---

## 1. Por que esta tela decide o beta

É aqui que o valor sai do produto. Tudo antes é setup; **exportar o primeiro orçamento é a Ação de Valor** — a métrica que determina o Go/No-Go.

Ao terminar esta tela, o fluxo principal do beta está de pé: cadastro → projeto → ambiente → itens → orçamento → export. As telas 010 e 011 podem, se necessário, entrar depois do dia 1.

E é onde a Giovanna foi mais específica: *"o interessante é facilitar o orçamento e conseguir exportar esse orçamento em wpp, pdf ou excel"*.

## 2. Escopo

**Dentro:**
- Montagem do orçamento: itens por ambiente, quantidades do Smart Core, preços, totais.
- Ajuste manual de quantidade e preço, com o valor calculado sempre visível ao lado.
- Export **WhatsApp** (texto), **PDF** e **Excel**.
- Link de compra por item e observações comerciais (`GIO-5`).
- `source_url` no export (Art. 11 §2).
- Brand Kit mínimo: logo e cor de destaque nos documentos gerados.

**Paridade:** os documentos que o módulo já gera hoje continuam existindo, sobre a mesma estrutura (§4). O inventário sai do código, na doc do módulo — não desta spec.

**Fora:**
- Editor de apresentação (anti-requisito).
- Aprovação do cliente dentro do produto (anti-requisito).
- Envio automático por API do WhatsApp — custa dinheiro e aprovação da Meta; o `share` nativo resolve.
- Cálculo de precificação do serviço — spec 015.

## 3. Comportamento

### Montagem

```
Dado um projeto com ambientes e itens
Quando o usuário abre o orçamento
Então vê os itens agrupados por ambiente, com quantidade calculada,
     preço unitário, total por item, subtotal por ambiente e total geral

Quando altera manualmente uma quantidade
Então o valor calculado continua visível ao lado, com opção de restaurar
```

Manter o calculado visível importa: o arquiteto precisa saber que está sobrescrevendo o cálculo, e conseguir voltar.

### Export para WhatsApp

Texto puro, via `navigator.share()` no mobile e cópia no desktop.

```
*Orçamento — Apartamento 102*
_Sala de estar · 24 m²_

• Porcelanato Acetinado 60x60 — 26 cx — R$ 2.340,00
  https://loja.exemplo.com/produto/123
• Tinta Acrílica Branco Neve — 4 latas — R$ 480,00
  https://loja.exemplo.com/produto/456

*Total: R$ 2.820,00*

_Frete não incluso._
_Promoções, ofertas ou saldos não serão computados._

Orçamento gerado com Arq Smart
```

As duas observações são pedido literal da Giovanna (`GIO-5`), pré-preenchidas e editáveis.

A assinatura final é aquisição orgânica: todo orçamento enviado é uma impressão da marca no cliente final e em quem mais estiver no grupo. `[DECISÃO PENDENTE]` mantê-la obrigatória ou removível em plano superior — decidir junto com o preço (spec 019).

Acima de ~40 itens o texto fica ilegível no app: sugerir export por ambiente ou PDF.

### Export em PDF

Capa (logo do arquiteto, projeto, cliente, data) · itens agrupados por ambiente com foto, quantidade, unitário e total · subtotal por ambiente · total geral · observações · **link da loja de origem em cada item** (Art. 11 §2).

### Export em Excel

Uma linha por item: Ambiente · Produto · Categoria · Fornecedor · Quantidade · Unidade · Preço unitário · Total · Link de compra · Fonte. Total por ambiente. Planilha limpa, sem enfeite — é para o cliente ou o comprador mexer.

## 4. Uma estrutura, várias saídas

```
app/services/budget/
├── builder.py       # monta a estrutura — fonte única
├── whatsapp.py      # texto
├── pdf.py           # PDF
└── excel.py         # planilha
```

Todas as saídas consomem a **mesma** estrutura. Divergência entre elas é bug de duplicação, não diferença de formato — e é o defeito mais comum em módulo de export.

**Paridade:** se o módulo já gera outros documentos hoje, eles entram como saídas adicionais sobre o mesmo `builder.py`, e não são reescritos como código separado. O inventário sai do código, na doc do módulo.

⚠️ **Confidencialidade no serializador:** a estrutura do `builder.py` carrega tudo, inclusive dado comercial interno. Cada saída destinada ao cliente final serializa apenas o que ele pode ver. O filtro fica no serializador, nunca na tela.

## 5. Dados

```sql
CREATE TABLE brand_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE,
    logo_url TEXT,
    accent_color TEXT,
    default_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE budget_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id),
    format TEXT NOT NULL,
    items_count INTEGER,
    total_value NUMERIC(12,2),
    snapshot JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

`budget_exports.snapshot` congela o que foi enviado. Se o preço da biblioteca mudar depois, **o orçamento que o cliente recebeu não muda** — e o arquiteto consegue provar o que enviou.

## 6. Performance

- Geração de PDF: meta <3 s para 50 itens. Acima disso, gerar assíncrono com aviso.
- Imagens do PDF redimensionadas antes de embutir — foto de fornecedor em resolução original gera PDF de 40 MB que não passa no WhatsApp.
- Montagem do orçamento em ≤4 queries, mesmo com 25 ambientes e 500 itens.

## 7. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| **`budget_exported`** 🎯 | **servidor** | `format`, `items_count`, `total_value`, `environments_count` |
| `budget_viewed` | cliente | `items_count`, `has_manual_overrides` |
| `budget_item_overridden` | servidor | `field` (`quantity`\|`price`) |
| `brand_settings_updated` | servidor | `has_logo`, `changed_color` |
| `export_failed` | servidor | `format`, `error_code` |
| `screen_viewed` | cliente | `screen`, `load_ms`, `is_empty` |

`budget_exported` é a Ação de Valor e **tem** que sair do servidor — bloqueador de anúncio não pode apagar a métrica que decide o lançamento.

`budget_item_overridden` diz onde o Smart Core está errando: se todo mundo corrige a quantidade da mesma categoria, o rendimento cadastrado está ruim.

## 8. Critérios de aceite

- [ ] Playbook cumprido integralmente.
- [ ] Todas as saídas partindo da mesma estrutura (`builder.py`).
- [ ] Paridade: todo documento que o módulo gerava antes continua sendo gerado, e o que é feito para impressão foi **conferido em papel**.
- [ ] Nenhuma saída destinada ao cliente contém dado comercial confidencial — verificado no JSON e no arquivo gerado, não na tela.
- [ ] WhatsApp: `share` nativo no mobile, cópia no desktop, **testado em Android e iOS reais**.
- [ ] Link de compra e observações no export; observações pré-preenchidas com os dois textos da Giovanna.
- [ ] `source_url` de cada item presente nos 3 formatos.
- [ ] PDF com logo e cor do arquiteto, gerado em <3 s para 50 itens, com imagens redimensionadas.
- [ ] Excel abre no Google Sheets e no Excel sem aviso de formato.
- [ ] Ajuste manual mantém o valor calculado visível, com restaurar.
- [ ] `snapshot` congelado no export.
- [ ] `budget_exported` emitido no servidor, com todas as propriedades.
- [ ] Nenhum export vaza item de outra conta.
- [ ] Valores financeiros mascarados no replay.
- [ ] Funciona em celular — é onde o arquiteto manda o orçamento.
- [ ] **A Giovanna exportou um orçamento real e aprovou o resultado nos 3 formatos.**
- [ ] `docs/dev/modulos/orcamento-export.md` + artigos "Montando um orçamento", "Enviando pelo WhatsApp", "Exportando em PDF e Excel".

## 9. Riscos

- **Risco:** PDF pesado demais para WhatsApp. → Redimensionar imagem e medir o arquivo final. Meta: <5 MB para 50 itens.
- **Risco:** texto do WhatsApp quebrado com muitos itens. → Acima de 40, sugerir por ambiente ou PDF.
- **Risco:** os 3 formatos divergirem com o tempo. → Fonte única no `builder.py` + teste que compara o total nos três.
