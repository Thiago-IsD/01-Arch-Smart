# Spec 012 — Compliance e LGPD no produto

| Campo | Valor |
|---|---|
| **Onda** | 3 |
| **Prioridade** | 5 |
| **Esforço** | M (1 semana) |
| **Responsável** | Thiago · conteúdo jurídico: Brenno |
| **Cobre** | `JUR-1` a `JUR-7` |

---

## 1. Problema

Os documentos jurídicos do projeto **já prometem** coisas ao usuário que o produto não faz:

- A Política de Privacidade diz que o titular pode pedir acesso, retificação, **exclusão** e **portabilidade** dos dados.
- O Termo de Uso e o Termo de Piloto pressupõem aceite registrado — a própria documentação especifica a tabela `legal_acceptances` com `account_id`, `lead_id`, `document_version` e `accepted_at`.
- O parecer do Web Clipper exige um **canal de takedown** funcionando.
- A política afirma guarda de logs de acesso por 6 meses (Marco Civil, Art. 15).

Publicar a política sem implementar isso é declarar algo que não existe. Não é papelada: são features.

## 2. Escopo

**Dentro:**
- `legal_acceptances` + telas de aceite e reaceite em nova versão.
- Consentimento de analytics e de gravação de sessão, separado do aceite dos termos.
- Export de todos os dados da conta (portabilidade).
- Exclusão de conta e dados.
- Canal de takedown (formulário + fluxo interno).
- Retenção de logs de acesso por 6 meses.
- Página `/legal` com os documentos versionados.

**Fora:**
- Redigir os documentos — é do Brenno.
- Nomear DPO — decisão societária.
- Consentimento de cookies de marketing (não há marketing pago).

## 3. Aceite de documentos

```sql
CREATE TABLE legal_acceptances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id),
    user_id UUID REFERENCES users(id),
    lead_id UUID,
    document_type TEXT NOT NULL,      -- TERMS | PRIVACY | PILOT
    document_version TEXT NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);
CREATE INDEX idx_acceptances_account ON legal_acceptances (account_id, document_type);
```

```
Dado um usuário se cadastrando
Então precisa aceitar TERMS, PRIVACY e PILOT explicitamente
E cada aceite grava a versão exata do documento, IP e data

Dado que um documento é publicado em versão nova
Quando o usuário entra
Então vê o que mudou e precisa reaceitar antes de continuar
E o aceite antigo permanece no histórico — nunca é sobrescrito
```

Registrar a **versão** é o ponto todo: sem ela, não há como provar a que texto a pessoa consentiu.

⚠️ **Depende do Brenno** publicar os documentos com o nome corrigido para **Arq Smart** e com e-mails que existem. Ver `product/06-dependencias-externas.md`.

## 4. Consentimento de analytics

Separado do aceite dos termos, com escolha própria.

```
Dado o primeiro acesso
Então o usuário decide sobre coleta de uso e gravação de sessão
E NADA é coletado antes dessa decisão
E a escolha pode ser revista em Configurações a qualquer momento
```

Empacotar consentimento de analytics com aceite de termos invalida os dois. São bases legais diferentes.

A tela explica em linguagem simples: o que é coletado, para quê, e que dados financeiros e de clientes finais **são mascarados** na gravação.

## 5. Portabilidade — export dos dados

```
Dado um usuário em Configurações > Meus dados
Quando pede a exportação
Então recebe por e-mail, em até 48h, um arquivo .zip com:
     - dados cadastrais (JSON)
     - projetos, ambientes e itens (JSON + CSV)
     - biblioteca completa (JSON + CSV)
     - transações financeiras (CSV)
     - orçamentos exportados (PDF)
```

Formato aberto e legível. Portabilidade em formato proprietário não é portabilidade.

O Termo de Piloto também promete que, ao fim do beta, o participante pode "exportar e cancelar sua conta sem custos" — esta feature é o que sustenta essa frase.

## 6. Exclusão de conta

```
Dado um usuário pedindo exclusão
Então confirma digitando o nome do escritório
E é avisado do que será perdido e do prazo
E a conta entra em READ_ONLY imediatamente
E os dados são apagados definitivamente em 30 dias
E ele pode cancelar dentro dos 30 dias

Dado que a exclusão se consuma
Então dado pessoal é apagado
E logs de acesso são retidos pelos 6 meses do Marco Civil, desvinculados quando possível
```

A janela de 30 dias existe porque exclusão acidental é irreversível e frequente. E a retenção de log não é contradição — é obrigação legal distinta, e precisa estar dita na política.

## 7. Canal de takedown (Art. 11 §3)

```
Dado um lojista que quer remover conteúdo capturado
Quando acessa /takedown (link público, sem login)
Então informa a URL de origem, a identificação da loja e o motivo
E o pedido entra numa fila interna com prazo de resposta

Dado um pedido aceito
Então os itens com aquele source_url são marcados como removidos em todas as contas
E os arquitetos afetados são avisados, com a fonte original preservada como referência
```

Item removido por takedown some da biblioteca mas **não some do orçamento já exportado** — aquele documento já foi enviado ao cliente final e o snapshot está congelado (spec 009).

```sql
CREATE TABLE takedown_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING',   -- PENDING, ACCEPTED, REJECTED
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE library_items
  ADD COLUMN takedown_at TIMESTAMP WITH TIME ZONE;
```

## 8. Retenção de logs

Logs de acesso guardados por 6 meses (Marco Civil, Art. 15) e expurgados depois — automaticamente. Guardar mais do que a lei pede aumenta risco sem aumentar proteção.

## 9. Página `/legal`

Documentos versionados, com data de vigência, histórico de versões e diff do que mudou. Linkada do rodapé, do cadastro e das configurações.

## 10. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `legal_terms_accepted` | servidor | `document_type`, `document_version`, `is_reaccept` |
| `analytics_consent_given` | servidor | `granted`, `replay_granted` |
| `data_export_requested` / `_completed` | servidor | `size_mb`, `duration_s` |
| `account_deletion_requested` | servidor | `reason`, `days_since_signup` |
| `account_deletion_canceled` | servidor | `days_into_window` |
| `takedown_requested` | servidor | `domain` |

`account_deletion_requested.reason` é o feedback mais honesto que o produto recebe — quem está saindo não tem motivo para ser gentil.

## 11. Critérios de aceite

- [ ] `legal_acceptances` gravando os 3 documentos com versão, IP e data.
- [ ] Nova versão de documento força reaceite; histórico preservado.
- [ ] Consentimento de analytics separado do aceite dos termos.
- [ ] **Nenhuma coleta antes do consentimento** — verificado com as ferramentas de rede do navegador.
- [ ] Export de dados entregando .zip completo em formato aberto.
- [ ] Exclusão com janela de 30 dias, cancelável, com `READ_ONLY` imediato.
- [ ] Expurgo de logs após 6 meses rodando automaticamente.
- [ ] `/takedown` público e funcional; item removido some das bibliotecas e o arquiteto é avisado.
- [ ] Item sob takedown **não** desaparece de orçamento já exportado.
- [ ] `/legal` com documentos versionados e histórico.
- [ ] Todos os links e e-mails apontam para o nome e o domínio corretos (Art. 8).
- [ ] `docs/dev/modulos/compliance.md` + artigos "Exportando seus dados" e "Encerrando sua conta".

## 12. Riscos

- **Risco:** documentos não publicados a tempo. → Dependência externa. Sem eles, `legal_acceptances` não tem o que registrar e o beta não pode começar.
- **Risco:** tratar isso como burocracia e adiar. → São features prometidas em documento público. Adiar é assumir o risco de declarar algo falso.
- **Risco:** exclusão apagar dado por engano. → Janela de 30 dias, confirmação por digitação e backup anterior à execução.
