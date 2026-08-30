# Spec 005 — Reescrita: Autenticação e conta

| Campo | Valor |
|---|---|
| **Onda** | 2 · tela 1 de 7 |
| **Prioridade** | 5 |
| **Esforço** | M (4 dias) |
| **Cobre** | `RW-01`, **`SEC-01`** · guardas de regressão: `A11y-01`, `UI-01` |
| **Playbook** | `memory/playbook-reescrita.md` — cumprimento integral obrigatório |

---

## 1. Por que primeiro

Tudo depende da sessão. Se o `account_id` sair errado daqui, sai errado em todas as outras seis telas. É a fundação da fundação.

E há um problema **ainda aberto** que mora aqui (`SEC-01`): produtos capturados são acessíveis por **link público, sem autenticação**. Registrado na ata de 18/08:

> *"Criar cadastro clientes: implementar sistema de cadastro e autenticação para clientes, eliminando o acesso aberto via link público para produtos capturados."*

⚠️ Isto **não é** o `UX-07` da auditoria — aquele (ID de conta fixo de seed) já foi corrigido. São dois furos distintos na mesma parede: um era o dado gravado na conta errada; este é o dado gravado na conta certa, mas acessível por URL adivinhável. Além de furo de isolamento, viola a **diretriz nº 1 do parecer jurídico** do Web Clipper (Art. 11 §1).

## 2. Telas e fluxos

| Fluxo | Telas |
|---|---|
| Entrar | Login, "esqueci minha senha", redefinir senha |
| Cadastrar | Registro, verificação de e-mail, aceite de termos |
| Conta | Perfil, alterar senha, dados do escritório |
| Sessão | Logout, expiração, renovação de token |

## 3. Comportamento

### Cadastro

```
Dado um visitante na tela de registro
Quando preenche nome, e-mail, senha e nome do escritório
E aceita Termo de Uso, Política de Privacidade e Termo de Piloto
Então uma account é criada com subscription_status = 'BETA'
E o aceite é gravado em legal_acceptances com a versão de cada documento
E o consentimento de analytics é solicitado separadamente
```

O aceite dos documentos e o consentimento de analytics são **coisas distintas** e precisam de escolhas distintas. Empacotar os dois numa caixinha só invalida os dois.

### Fim dos recursos públicos

```
Dado um link antigo de produto capturado
Quando alguém sem sessão acessa
Então recebe 401 e é levado ao login

Dado um recurso que precisa ser compartilhado (ex.: orçamento para o cliente final)
Então o acesso é por token assinado, com escopo do recurso e expiração
E o token não permite listar nem descobrir outros recursos
```

O portal do cliente continua existindo — mas por token assinado, não por URL adivinhável.

### Recuperação de senha

Token de uso único, expiração de 1h, e-mail sem revelar se a conta existe. Resposta idêntica para e-mail existente e inexistente — do contrário a tela vira enumerador de usuários.

## 4. Dados

Usa `accounts`, `users` e `legal_acceptances` (specs 001 e 012). Sem tabela nova.

```sql
ALTER TABLE users
  ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN analytics_consent_at TIMESTAMP WITH TIME ZONE;
```

`last_login_at` alimenta o Admin Master (spec 018) e a leitura de retenção do beta.

## 5. API

| Método | Rota |
|---|---|
| `POST` | `/api/v1/auth/register` |
| `POST` | `/api/v1/auth/login` |
| `POST` | `/api/v1/auth/logout` |
| `POST` | `/api/v1/auth/refresh` |
| `POST` | `/api/v1/auth/forgot-password` |
| `POST` | `/api/v1/auth/reset-password` |
| `POST` | `/api/v1/auth/verify-email` |
| `GET` `PATCH` | `/api/v1/me` |
| `POST` | `/api/v1/me/change-password` |

## 6. Requisitos específicos desta tela

**Segurança**
- Rate limit no login e no forgot-password (proteção contra força bruta e enumeração).
- Senha com hash forte; nunca em log, nunca no replay.
- Token de sessão em cookie `httpOnly` + `Secure` + `SameSite`.
- Mensagem de erro genérica em login ("e-mail ou senha inválidos"), nunca dizendo qual dos dois falhou.

**Acessibilidade** — o botão de ver senha é focável por Tab (`A11y-01` era exatamente isto) · todo campo via `FormField` · erro anunciado por leitor de tela · foco vai ao primeiro campo inválido.

**Marca** — cor do botão vem de `--primary`, nunca `bg-[#008080]` (`UI-01`). Nenhuma ocorrência de "ArchSmart" ou "Ecowe". Os links de Termo de Uso e Política de Privacidade apontam para os documentos **com o nome corrigido** — se ainda estiverem como "ARCHSMART", a tela espera (Art. 8).

**Replay** — campos de senha e documento com `data-private`.

## 7. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `account_created` | servidor | `source` |
| `legal_terms_accepted` | servidor | `document_type`, `document_version` |
| `analytics_consent_given` | servidor | `granted` (bool) |
| `session_started` | servidor | `is_first_session` |
| `login_failed` | servidor | `reason` (sem revelar ao usuário) |
| `password_reset_requested` | servidor | — |
| `screen_viewed` | cliente | `screen`, `load_ms` |
| `form_abandoned` | cliente | `form`, `last_field` |

`form_abandoned` no registro é uma das métricas mais úteis do beta: mostra em qual campo as pessoas desistem de criar conta.

## 8. Critérios de aceite

- [ ] Playbook cumprido integralmente (5 estados, performance, A11y, docs).
- [ ] **Nenhum recurso do produto acessível sem sessão** — varredura de rotas confirmando.
- [ ] Compartilhamento externo só por token assinado, com escopo e expiração.
- [ ] Aceite dos 3 documentos gravado com versão e data.
- [ ] Consentimento de analytics separado do aceite dos termos.
- [ ] Botão de ver senha alcançável por Tab.
- [ ] Erro de login genérico; forgot-password não revela existência de conta.
- [ ] Rate limit ativo em login e forgot-password.
- [ ] Senha e documento mascarados no replay — conferido.
- [ ] Nenhuma cor literal; nenhuma menção a marca antiga.
- [ ] `docs/dev/modulos/autenticacao.md` e o artigo "Criando sua conta" escritos.

## 9. Riscos

- **Risco:** links públicos antigos já circularem com clientes finais dos arquitetos. → Mitigação: manter os links antigos respondendo com uma página explicativa e caminho para o novo acesso, por 30 dias. Quebrar em silêncio gera suporte e desconfiança.
- **Risco:** documentos jurídicos ainda como "ARCHSMART" na hora de linkar. → É dependência externa (Brenno). Se não estiverem prontos, a tela fica pronta e o link fica apontando para staging até a publicação.
