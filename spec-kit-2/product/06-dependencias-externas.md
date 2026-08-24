# Dependências Externas

**Versão 1.0 — 23/08/2026**

> Este kit trata **apenas de produto e tecnologia**. Os itens abaixo **não são desenvolvimento** e não têm spec — mas cada um bloqueia alguma coisa aqui dentro. Estão listados só para que ninguém descubra o bloqueio tarde demais.

---

## Bloqueiam o início do beta

| Item | Responsável | Bloqueia | Por quê |
|---|---|---|---|
| **Publicar Termo de Uso, Política de Privacidade e Termo de Piloto** | Brenno | Portão A do beta | A tabela `legal_acceptances` (spec 012) precisa de documentos reais e versionados para registrar aceite. Sem documento publicado, não há aceite a registrar. |
| **Corrigir os documentos jurídicos de "ARCHSMART" para "Arq Smart"** | Brenno | specs 005, 012 | As telas linkam para os documentos e para os e-mails de contato. Linkar para um nome e um domínio que não são os oficiais é erro visível ao beta-tester. |
| **Criar os e-mails institucionais** (`dpo@`, `privacidade@`, `compliance@`) no domínio correto | Brenno + Marketing | spec 012 | Os três documentos publicam esses endereços. Se não existirem, o canal de takedown e o de direitos do titular não funcionam — e ambos são exigência legal. |
| **Recrutar 10–15 arquitetos com onboarding agendado** | Giovanna | Portão A | Sem testers não há beta. |
| **Ratificar a Ação de Valor** | Giovanna | spec 003 | Define o que o funil mede. |

## Bloqueiam a Onda 6 (Billing)

| Item | Responsável | Bloqueia | Observação |
|---|---|---|---|
| **Criar conta no Asaas e obter as chaves de API** | Thiago | spec 019 inteira | Gateway decidido: **Asaas**. |
| **Homologação de PIX e boleto no Asaas** | Thiago | spec 019 | ⚠️ Começar **em paralelo à Onda 4**. Burocracia bancária leva semanas e não depende de código. |
| **Definir o preço do plano único** | João Lucas | spec 019 | Um plano no lançamento. Precisa estar definido antes do fim do beta, para que a pergunta de intenção de pagar seja feita com o preço real. |
| **Entender o impacto de IBS/CBS na precificação** | João Lucas | spec 019 | O tributo passa a ser somado por fora a partir de janeiro. A spec 019 já prevê preço-base + tributo destacado. |

## Não bloqueiam nada aqui (registrados para não voltarem à pauta de produto)

| Item | Responsável | Status |
|---|---|---|
| Registro da marca no INPI | Brenno | Registrado (18/08) — conferir sob qual grafia |
| Abertura de CNPJ | João Lucas / Brenno | Adiado até haver tração (11/08) |
| Contrato de parceria entre sócios (vesting, IP assignment) | Brenno | Minuta pronta no `juridico_organizacional.html` |
| Aporte inicial | João Lucas | Esclarecido em 11/08: não representa dinheiro do bolso dos sócios |
| Identidade visual e logo | Thiago | Em aberto. Não bloqueia a reescrita — o design system nasce com tokens semânticos e valores provisórios (spec 002) |
| Emissão de nota fiscal | João Lucas | Adiado (18/08) |

---

## Risco de capacidade registrado

Na ata de 11/08, o Thiago mencionou possível alteração na carga horária presencial do emprego, o que pode afetar a disponibilidade dele para o projeto.

Como ele é o dev principal e as Ondas 1 a 3 somam 12–14 semanas de trabalho de uma pessoa, isso é o risco mais material do roadmap inteiro. As três saídas estão no fim do `03-backlog.md`: reduzir a Onda 2, aumentar capacidade (Brenno codificando junto, como combinado em 11/08), ou mover a data.

## Risco de processo registrado

Na ata de 18/08 ficou registrado que Brenno e João Lucas produziram **a mesma tarefa jurídica em duplicata** — política de privacidade e termos de uso — por falha de comunicação.

Com um dev e um calendário apertado, retrabalho é o que menos cabe. O combinado foi usar o grupo ativamente entre as reuniões, em vez de acumular tudo para o encontro semanal.
