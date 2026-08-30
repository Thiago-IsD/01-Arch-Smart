# Spec 017 — Projetos: templates de etapas e arquivos

| Campo | Valor |
|---|---|
| **Onda** | 4 |
| **Prioridade** | 3 |
| **Esforço** | M (templates) + G (arquivos) |
| **Cobre** | `MOD-9`, `MOD-10`, `SUG-7` |

---

## 1. Problema

**Templates.** Todo arquiteto repete a mesma estrutura de etapas a cada projeto — e recria do zero toda vez. A Giovanna pediu templates padrão e a possibilidade de criar os próprios, com checklist e "pontos de atenção".

**Arquivos.** *"Na aba de projetos poderíamos conseguir criar pastas como no Drive, assim a gente concentra literalmente tudo em um lugar só."* O arquiteto guarda plantas, referências, contratos e fotos espalhados entre Drive, WhatsApp e desktop.

## 2. Ressalva de escopo

Os dois pedidos têm perfis de risco muito diferentes:

- **Templates de etapas** são baratos, específicos do domínio, e ninguém oferece pronto para arquitetura residencial brasileira. Bom investimento.
- **Pastas de arquivos** significa competir com o Google Drive em armazenamento — com custo real de storage, backup, versionamento, preview e busca. O Drive é gratuito, já está instalado e o arquiteto já organizou a vida dele lá.

**Recomendação:** entregar templates primeiro, isolado. Para arquivos, começar com **anexos por projeto** (lista simples, sem hierarquia). Só construir hierarquia se o uso mostrar que as pessoas anexam muito e reclamam da organização.

`[DECISÃO PENDENTE]` Alternativa que merece consideração: **integrar com o Google Drive** em vez de substituí-lo — vincular uma pasta do Drive do usuário ao projeto. Entrega o "tudo num lugar só" sem assumir custo de storage nem competir com um produto gratuito.

## 3. Escopo

**Fase 1 — Templates:** templates de sistema para os tipos comuns · etapa com nome, ordem, duração estimada, checklist e pontos de atenção · aplicar ao criar projeto · criar, editar, duplicar template próprio · status por etapa (`Novo` · `Em andamento` · `Concluído` · `Paralisado`).

**Fase 2 — Arquivos (a decidir):** anexos por projeto com tipo e tamanho validados · hierarquia **só se** a fase 1 mostrar demanda.

**Fora:** versionamento de arquivo · edição de documento no produto · compartilhamento externo (o portal do cliente da spec 011 já faz isso).

## 4. Templates padrão

**Projeto arquitetônico + interiores:** Briefing → Levantamento → Estudo preliminar → Anteprojeto → Projeto executivo → Detalhamento → Especificação e orçamento → Acompanhamento de obra

**Consultoria de interiores:** Briefing → Visita técnica → Estudo → Apresentação → Lista de compras

**Consultoria imobiliária:** Briefing → Análise do imóvel → Relatório → Apresentação

Alinhados com `GIO-7`.

ℹ️ `MOD-9` pede também um "guia para transformar leads frios em clientes". Isso é **template comercial**, não de projeto — pertence à spec 016 (pipeline). Registrar lá, não duplicar aqui.

## 5. Dados

```sql
CREATE TABLE project_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id),   -- NULL = do sistema
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE
);

CREATE TABLE project_template_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES project_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    estimated_days INTEGER,
    checklist JSONB DEFAULT '[]'::jsonb,
    attention_points TEXT
);

CREATE TABLE project_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    status TEXT DEFAULT 'NEW',
    due_date DATE,
    checklist JSONB DEFAULT '[]'::jsonb,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Fase 2
CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    parent_folder_id UUID REFERENCES project_files(id),
    is_folder BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

`project_stages` é **cópia** do template no momento da aplicação, não referência. Editar um template depois **não** altera projetos em andamento — mesma regra do DNA (spec 007) e da calculadora (spec 015).

## 6. Telemetria

| Evento | Propriedades |
|---|---|
| `project_template_applied` | `is_system`, `stages_count` |
| `project_template_created` | `stages_count`, `duplicated_from` |
| `project_stage_completed` | `stage_name`, `days_in_stage` |
| `project_file_uploaded` | `mime_type`, `size_bytes` |

## 7. Critérios de aceite

- [ ] 3 templates de sistema disponíveis, redigidos com a Giovanna.
- [ ] Aplicar template ao criar projeto gera as etapas com checklist.
- [ ] Usuário cria, edita e duplica template próprio (copy-on-write), isolado na conta.
- [ ] **Editar template não altera projeto em andamento** — teste explícito.
- [ ] Status por etapa com os 4 valores; marcar item do checklist persiste na hora.
- [ ] Reordenação por arrastar e soltar, com alternativa por teclado.
- [ ] Decisão de §2 tomada **antes** de qualquer código de arquivos.
- [ ] Se houver anexos: limite de tamanho vindo dos entitlements, tipo validado, storage isolado por conta.
- [ ] Arquivos incluídos no export e na exclusão de dados (spec 012).
- [ ] Doc de dev + artigos de usuário.
