# Tasks 004 — Documentação

## Estrutura

- [ ] **T-004.1** — Criar `/docs/dev/` e `/docs/user/` com `README.md` em cada nível
- [ ] **T-004.2** — `docs/template-doc-modulo.md`
- [ ] **T-004.3** — `docs/template-artigo-ajuda.md`
- [ ] **T-004.4** — `docs/dev/decisoes/` com o template de ADR

## Páginas fundacionais de dev

- [ ] **T-004.5** — `ambiente.md`: subir o projeto do zero
  - Aceite: **o Brenno sobe o projeto seguindo só a doc, em <30 min, sem perguntar nada**. Se ele travar, a doc está errada — corrija e repita.
- [ ] **T-004.6** — `arquitetura.md` (sai da spec 001)
- [ ] **T-004.7** — `convencoes.md`
  - Aceite: inclui o que é **proibido** e por qual artigo da constitution
- [ ] **T-004.8** — `modelo-de-dados.md`
  - Aceite: schema comentado, com o porquê de cada relação, não só o DDL
- [ ] **T-004.9 [P]** — `deploy.md`: ambientes, esteira e **como reverter em 5 minutos**

## ADRs iniciais

- [ ] **T-004.10** — ADR 0001: manter Vercel + Render + Supabase no beta
- [ ] **T-004.11** — ADR 0002: reescrever em vez de refatorar
  - Aceite: registra o que se espera ganhar e **como isso será medido** — senão não dá para saber se valeu
- [ ] **T-004.12** — ADR 0003: Asaas como gateway

## Documentação de usuário

- [ ] **T-004.13** — Definir tom, estrutura e glossário com a Giovanna
- [ ] **T-004.14** — Escrever um artigo-piloto ("Montando um orçamento") como referência de qualidade
  - Aceite: a Giovanna leria isso para uma colega sem se envergonhar
- [ ] **T-004.15** — Decidir onde a central de ajuda vive
  - Recomendação: Markdown no repositório, renderizado em `/ajuda`

## Processo

- [ ] **T-004.16** — Incluir "doc atualizada?" no checklist de revisão de PR
- [ ] **T-004.17** — Adicionar `Última revisão: AAAA-MM-DD` no topo das páginas de módulo

---

## Definition of Done

- [ ] Estrutura e templates criados
- [ ] `ambiente.md` validada pelo Brenno subindo o projeto sozinho
- [ ] 3 ADRs escritas
- [ ] Artigo-piloto de usuário aprovado pela Giovanna
- [ ] Regra "PR sem doc não mergeia" ativa
