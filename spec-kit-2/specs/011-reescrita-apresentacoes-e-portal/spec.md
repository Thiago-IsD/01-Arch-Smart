# Spec 011 — Reescrita: Apresentações e Portal do Cliente

| Campo | Valor |
|---|---|
| **Onda** | 2 · tela 7 de 7 |
| **Prioridade** | 3 |
| **Esforço** | M (5 dias) |
| **Cobre** | `RW-07`, `SEC-01` · aplica os anti-requisitos `GIO-8` e `MOD-13` |
| **Playbook** | `memory/playbook-reescrita.md` |

---

## 1. Escopo reduzido — e por quê

A direção está decidida em `product/01-visao-de-produto.md` §7: **export primeiro, editor não.**

A Giovanna, arquiteta do time e voz do cliente, foi explícita:

> *"A apresentação deve ser criada pelo próprio arquiteto na plataforma que ele já está acostumado."*
> *"Design está engessado e arquitetos têm perfis mais criativos, a apresentação é o que vende o projeto."*
> *"Não precisa ter avaliação do cliente porque a apresentação acontece e as alterações devem ser ao vivo, é mais humanizado."*

Competir com o Canva em editor visual, com quatro sócios e orçamento zero, contra um usuário profissionalmente treinado em estética, é uma guerra perdida antes de começar. O esforço rende muito mais no export (spec 009) e no moat.

**Anti-requisitos, registrados para não voltarem por inércia:**
- ❌ `GIO-8` — avaliação/aprovação do cliente sobre a apresentação dentro do produto.
- ❌ `MOD-13` — galeria de modelos de apresentação editáveis.
- ❌ Editor de slides.

## 1b. ⚠️ A única exceção à paridade

A regra do playbook é paridade: nada que funcionava para de funcionar. **`GIO-8` é a exceção deliberada.**

Se a aprovação de item pelo cliente existir hoje no portal, **a reescrita não a reconstrói** — por decisão da Giovanna, registrada em 21/07: *"não precisa ter avaliação do cliente porque a apresentação acontece e as alterações devem ser ao vivo, é mais humanizado dessa forma"*.

Isso é diferente de "não construir algo novo": é aposentar trabalho já feito. Duas razões pelas quais ainda assim é a escolha certa agora — zero clientes pagantes, então aposentar custa quase nada; e reconstruir custa dias de dev num calendário sem folga. Se um beta-tester pedir, reconstruir depois é pequeno, e aí a decisão terá uso real por trás.

⚠️ Antes de remover em produção: confirmar na telemetria se alguém chegou a usar. Uso zero torna a decisão trivial; uso real merece reabrir a conversa com o dado na mão.

## 2. O que fica

| Item | Escopo |
|---|---|
| **Prancha do projeto** | visualização dos ambientes com os itens especificados, foto, quantidade e **fonte** (Art. 11 §2). É consulta e apresentação ao vivo, não edição. |
| **Linha do tempo** | etapas do projeto e progresso. Paridade com o que existe. |
| **Portal do cliente** | acesso do cliente final ao que o arquiteto compartilhou. **Reescrito por token assinado**, não por link público (`SEC-01`). Nenhum dado comercial confidencial é serializado na resposta. |
| **Brand Kit mínimo** | logo e cor aplicados à prancha e ao PDF. Compartilhado com a spec 009. |

## 3. O portal do cliente e a segurança

Esta é a parte que mais muda. Hoje há acesso por link público. Passa a ser:

```
Dado que o arquiteto compartilha um projeto com o cliente final
Então é gerado um token assinado, com escopo daquele projeto e expiração

Dado alguém com o token
Então vê apenas aquele projeto, em modo somente leitura
E não consegue listar, adivinhar ou navegar para outros recursos

Dado um token expirado ou revogado
Então vê uma página explicativa com o contato do arquiteto
```

O arquiteto vê quais links criou, quando foram acessados e pode revogar qualquer um.

⚠️ **Sem cadastro para o cliente final.** Exigir que o cliente do arquiteto crie conta no Arq Smart para ver o projeto dele mata a experiência que o produto quer entregar. Token assinado dá a segurança sem o atrito.

**LGPD:** aqui somos Operadores dos dados do cliente final (Art. 12). Nome do cliente na prancha e no portal é mascarado no replay.

## 4. Dados

```sql
CREATE TABLE share_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    resource_type TEXT NOT NULL,      -- PROJECT | BUDGET
    resource_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Guardar **hash** do token, não o token. Se o banco vazar, os links compartilhados não vazam junto.

## 5. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `share_link_created` | servidor | `resource_type`, `has_expiration` |
| `share_link_accessed` | servidor | `resource_type`, `is_first_access` |
| `share_link_revoked` | servidor | `days_active`, `access_count` |
| `presentation_viewed` | cliente | `environments_count` |
| `screen_viewed` | cliente | `screen`, `load_ms`, `is_empty` |

`share_link_accessed` responde uma pergunta que ninguém consegue responder hoje: **o cliente final abre mesmo?** Se ninguém abre, o portal não deveria estar no roadmap.

## 6. Critérios de aceite

- [ ] Playbook cumprido integralmente.
- [ ] **Nenhum acesso público sem token assinado.**
- [ ] Token com escopo de recurso, expiração e revogação; hash no banco, nunca o token.
- [ ] Token não permite descobrir ou listar outros recursos.
- [ ] Cliente final acessa **sem criar conta**.
- [ ] Arquiteto vê seus links, os acessos e consegue revogar.
- [ ] Link expirado mostra página explicativa, não erro cru.
- [ ] `source_url` visível na prancha (Art. 11 §2).
- [ ] Logo e cor do Brand Kit aplicados.
- [ ] Nome do cliente final mascarado no replay.
- [ ] O payload do portal não contém nenhum dado comercial confidencial — verificado no JSON.
- [ ] `GIO-8`: uso conferido na telemetria antes de remover; feature não reconstruída.
- [ ] Nenhum editor de slides, nenhuma galeria de modelos, nenhuma tela de aprovação do cliente.
- [ ] `docs/dev/modulos/apresentacoes-portal.md` + artigo "Compartilhando o projeto com seu cliente".

## 7. Riscos

- **Risco:** alguém reabrir o editor de apresentações no meio do beta. → Os anti-requisitos estão em três lugares (visão, backlog, esta spec). Reabrir exige decisão registrada, não conversa.
- **Risco:** links públicos antigos já estarem com clientes finais. → Manter respondendo com página explicativa por 30 dias e caminho para o novo acesso (mesma mitigação da spec 005). Quebrar em silêncio gera suporte e desconfiança.
