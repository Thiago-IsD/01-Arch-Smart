# Spec NNN — [Nome]

| Campo | Valor |
|---|---|
| **Onda** | 1–7 |
| **Prioridade** | 1–5 |
| **Esforço** | P / M / G / GG |
| **Responsável** | |
| **Status** | Rascunho / Aprovada / Em execução / Entregue |
| **Cobre** | IDs do backlog |

---

## 1. Problema

Qual dor real, de qual usuário, em que momento. Uma frase que a Giovanna reconheceria como verdadeira.

> Evidência: ata, auditoria, feedback de beta-tester, métrica ou parecer.

## 2. Resultado esperado

O que muda na vida do arquiteto. Uma frase, observável de fora.

## 3. Escopo

**Dentro:** …

**Fora (explicitamente):** …

Fora é tão importante quanto dentro — é o que impede a feature de crescer no meio da execução.

## 4. Comportamento

```
Dado que …
Quando …
Então …
```

Depois: casos de borda e os 5 estados (padrão, carregando, vazio, erro, foco).

## 5. Dados

```sql
-- migração proposta; snake_case plural, PK UUID, account_id NOT NULL
```

## 6. API

| Método | Rota | Regra |
|---|---|---|
| | `/api/v1/…` | |

## 7. UI

Telas afetadas, componentes do design system usados, onde entra na navegação.

## 8. Telemetria (Art. 10)

| Evento | Origem | Propriedades |
|---|---|---|
| | servidor / cliente | |

⚠️ Valor financeiro exato nunca vai para analytics — use faixas.
⚠️ Campo sensível marcado com `data-private` para o replay.

## 9. Critérios de aceite

- [ ] …

Cada um verificável por outra pessoa sem perguntar nada a você.

## 10. Riscos e decisões pendentes

- `[DECISÃO PENDENTE]` … — quem decide, até quando.
- Risco: … → mitigação: …

## 11. Referências
