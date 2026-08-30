# Spec 007 — Reescrita: Projetos e Ambientes (DNA)

| Campo | Valor |
|---|---|
| **Onda** | 2 · tela 3 de 7 |
| **Prioridade** | 5 |
| **Esforço** | G (1,5–2 semanas) |
| **Cobre** | `RW-03`, `GIO-7` · guardas de regressão: `UX-03`, `UX-06`, `A11y-03`, máscara de telefone |
| **Playbook** | `memory/playbook-reescrita.md` |

---

## 1. O que é

O núcleo do modelo de dados: um **projeto** tem **ambientes**; cada ambiente tem área em m², margem de quebra e itens vinculados. É aqui que mora o **Smart Core** — o cálculo que substitui a planilha:

```
quantidade = (área × (1 + margem_de_quebra)) ÷ rendimento_por_unidade
```

É a promessa central do produto. Se esse número sair errado, o arquiteto compra material a mais ou a menos, e perde dinheiro confiando na gente.

## 2. Escopo

**Dentro:**
- Lista de projetos, com limite do plano vindo dos entitlements.
- Criação de projeto (wizard) e edição.
- Ambientes: criar, editar, duplicar, excluir.
- **DNA do Ambiente** — ambiente reutilizável entre projetos.
- Smart Core como serviço puro e testado.
- Itens do projeto, com quantidade calculada e status.
- Lista de serviços corrigida (`GIO-7`).

**Fora:**
- Templates de etapas (`MOD-9/10`) — spec 017.
- Pastas e arquivos (`SUG-7`) — spec 017.
- Vínculo com cliente do CRM — spec 016.
- Orçamento e exportação — spec 009.

## 3. Smart Core

Serviço puro em `app/services/smart_core.py`. Sem I/O, sem ORM, testável isoladamente.

```python
def calculate_quantity(
    area_m2: Decimal,
    waste_margin_pct: Decimal,   # ex.: 10.00 = 10%
    yield_per_unit: Decimal,     # ex.: m² por caixa
) -> Decimal:
    """(área × (1 + margem)) ÷ rendimento, arredondado para cima."""
```

Regras não-óbvias que precisam estar na doc do módulo:

- **`Decimal` sempre.** Nunca `float` para quantidade ou dinheiro.
- **Arredondar para cima**, sempre. Caixa de porcelanato não se compra pela metade — e faltar material na obra é muito pior que sobrar.
- Rendimento zero ou nulo não calcula: o item entra como "quantidade a definir" com aviso claro, nunca com zero silencioso.
- A margem de quebra tem padrão de 10%, editável por ambiente e por item.

⚠️ **Isto exige ≥12 testes unitários.** É o cálculo que o cliente do arquiteto vai conferir na obra.

## 4. DNA do Ambiente

O diferencial: uma "sala de estar de 24 m²" que o arquiteto montou uma vez pode virar ponto de partida de outro projeto.

```
Dado um ambiente com itens vinculados
Quando o usuário escolhe "Salvar como DNA"
Então o ambiente vira modelo reutilizável na conta dele

Quando ele aplica um DNA a um novo ambiente
Então os itens são copiados e as quantidades recalculadas pela nova área
```

**Cópia, não referência.** Alterar um DNA depois **não** pode alterar projetos já montados — é a mesma regra dos templates e da calculadora: o que foi entregue ao cliente não muda sozinho.

## 5. Comportamento

### Limite de projetos

```
Dado um usuário no limite de projetos ativos do plano
Quando tenta criar mais um
Então vê quantos usa de quantos tem, com o caminho para liberar
E o limite vem dos entitlements, nunca do código (UX-03)
E o evento quota_limit_hit é emitido
```

### Exclusão

Sempre por `AlertDialog` do design system, nunca `confirm()` nativo (`UX-06`). Excluir ambiente diz quantos itens serão perdidos junto. Excluir projeto exige digitar o nome.

### Lista de serviços (`GIO-7`)

- ✅ Projeto arquitetônico + interiores · Consultoria de Interiores · Consultoria Imobiliária
- ❌ Remover Consultoria Express
- ℹ️ Gestão de obra pode ser "gestão" ou "assessoria de execução", embutida ou não numa proposta

## 6. Dados

```sql
-- projects e environments existem; ajustar:
ALTER TABLE projects
  ADD COLUMN account_id UUID NOT NULL REFERENCES accounts(id),
  ADD COLUMN created_by UUID REFERENCES users(id),
  ADD COLUMN service_type TEXT,
  ADD COLUMN client_phone TEXT;

CREATE TABLE environment_templates (   -- DNA
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    created_by UUID REFERENCES users(id),
    name TEXT NOT NULL,
    reference_area_m2 NUMERIC(10,2),
    default_waste_margin NUMERIC(5,2) DEFAULT 10.00,
    items JSONB NOT NULL,   -- snapshot dos itens
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_environments_project ON environments (project_id);
CREATE INDEX idx_project_items_environment ON project_items (environment_id);
```

Os dois índices são o remédio mais barato para a lentidão relatada — a lista de ambientes e o detalhe do ambiente são exatamente as consultas que faziam varredura completa.

## 7. Performance

Ponto de atenção específico: o detalhe do projeto carrega projeto → ambientes → itens → dados de biblioteca. É a cascata clássica de N+1.

- `selectinload` em toda a cadeia. **Meta: ≤4 queries** para o detalhe completo do projeto.
- Paginação na lista de projetos e na lista de itens do ambiente.
- Cálculo do Smart Core no servidor, entregue junto com os itens — não uma chamada por item.

## 8. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `project_created` | servidor | `project_id`, `total_area_m2`, `service_type`, `project_index` |
| `environment_created` | servidor | `area_m2`, `waste_margin`, `from_dna` |
| `quantity_calculated` | servidor | `items_count` |
| `dna_saved` / `dna_applied` | servidor | `items_count` |
| `quota_limit_hit` | servidor | `limit_type`, `current`, `max` |
| `project_deleted` | servidor | `had_environments`, `days_since_created` |
| `screen_viewed` | cliente | `screen`, `load_ms`, `is_empty` |

`from_dna` responde se o DNA — que é parte da tese de moat — está sendo usado de verdade.

## 9. Critérios de aceite

- [ ] Playbook cumprido integralmente.
- [ ] Smart Core como serviço puro, com ≥12 testes unitários, usando `Decimal` e arredondando para cima.
- [ ] Rendimento ausente gera "quantidade a definir", nunca zero silencioso.
- [ ] DNA salva e aplica por **cópia**; editar o DNA não altera projeto existente.
- [ ] Limite de projetos vindo dos entitlements.
- [ ] Exclusão via `AlertDialog`, com consequência explícita.
- [ ] Telefone do cliente com máscara brasileira.
- [ ] Lista de serviços conforme `GIO-7`.
- [ ] Detalhe do projeto em ≤4 queries; dentro do orçamento de performance com 25 ambientes e 500 itens.
- [ ] Nome e telefone do cliente final mascarados no replay.
- [ ] `docs/dev/modulos/projetos-ambientes.md` + artigos "Criando ambientes e áreas", "Como as quantidades são calculadas" e "Margem de quebra".

## 10. Riscos

- **Risco:** erro no Smart Core chegar à obra. → ≥12 testes + validar 3 projetos reais da Giovanna contra a planilha dela antes de considerar pronto.
- **Risco:** DNA por referência parecer mais elegante. → Não é. Snapshot, sempre. O arquiteto não pode ver o orçamento que enviou mudar sozinho.
