# Relatório Técnico: Auditoria de Produto, UX/UI e Arquitetura Front-end
**Projeto:** Arch Smart Web App  
**Autor:** Especialista Principal em UX/UI, Product Designer e Engenheiro Front-end Sênior  
**Status:** Concluído  
**Data:** 18 de Junho de 2026  

---

## 1. Resumo Executivo

Este documento apresenta uma análise aprofundada da usabilidade, layout, acessibilidade e qualidade do código da interface do usuário (UI) do aplicativo **Arch Smart**. O objetivo desta auditoria é identificar atritos de usabilidade, inconsistências visuais, gargalos de performance no carregamento de páginas (Next.js) e vulnerabilidades de consistência de dados que afetam a experiência do usuário.

Foram avaliados os fluxos de autenticação, o painel de métricas (dashboard), a listagem e criação de projetos, o módulo financeiro e a biblioteca de produtos. As descobertas foram catalogadas em uma **Matriz de Plano de Ação** ao final deste relatório para facilitar a exportação diretamente para o backlog de desenvolvimento (ex: Jira, Linear ou GitHub Issues).

---

## 2. Análise de Usabilidade (UX)

A avaliação de usabilidade foi estruturada utilizando como base as **10 Heurísticas de Nielsen**, que fornecem diretrizes consolidadas para o design de interfaces de usuário.

### 2.1. Visibilidade do Status do Sistema (Heurística #1)
> [!NOTE]
> O status do sistema refere-se à capacidade da interface de manter o usuário informado sobre o que está acontecendo e onde ele se encontra.

* **Ausência de Breadcrumbs Ativos**: O layout principal do painel ([AppShell.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/layout/AppShell.tsx)) implementa o `BreadcrumbProvider` (linha 118), mas o cabeçalho exibe apenas a mensagem de boas-vindas estática `"Bem-vindo à Arch Smart"` e a data atual (linhas 349-362). A navegação estrutural (ex: *Projetos > Apartamento 102 > Ambientes*) não possui feedback visual no header, deixando o usuário desorientado em fluxos mais profundos.
* **Bloqueio Completo por Tela de Carregamento**: No dashboard ([page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx#L153-L160)), o estado de carregamento inicial bloqueia a tela inteira renderizando um spinner cinza (`Loader2`) com altura total de 70vh. Esse padrão de "bloqueio" aumenta a latência percebida pelo usuário. Recomenda-se a adoção de *Skeleton Screens* que mantêm a estrutura visual da página ativa.

### 2.2. Prevenção de Erros & Reconhecimento vs. Recordação (Heurísticas #5 e #6)
> [!WARNING]
> Um design de excelência deve evitar que o erro ocorra, em vez de apenas emitir mensagens de erro eficientes.

* **Placeholders como Rótulos de Dimensões**: No formulário de inserção de especificações do produto ([ProductFormSheet.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/library/ProductFormSheet.tsx#L328-L364)), os inputs de Largura, Altura e Profundidade usam placeholders de uma única letra (`L`, `A`, `P`) sem labels externas persistentes. Assim que o usuário digita um número, a letra indicativa some, forçando o usuário a apagar o valor ou confiar na memória para identificar o campo.
* **Falta de Validação em Tempo Real (Módulo Financeiro)**: O componente de lançamento manual de receitas e despesas ([QuickEntryDialog.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx#L63-L67)) realiza a validação apenas no momento do envio (`handleSave`). Se houver campos em branco, o sistema dispara um popup (`toast`) genérico no canto da tela. O usuário não recebe feedback visual inline vermelho abaixo de cada input inválido.
* **Falta de Máscaras e Formatação Monetária**:
  * Os campos de valores financeiros nos formulários de transações utilizam inputs numéricos brutos do tipo `number`. Não há formatação automática (como `R$ 1.500,00` em tempo real), o que aumenta a incidência de erros de digitação (ex: confundir zeros decimais).
  * O formulário de criação de projetos ([ProjectWizard.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/ProjectWizard.tsx#L347)) não possui máscara ou validação de formato para o telefone do cliente, aceitando strings arbitrárias de qualquer tamanho.

### 2.3. Consistência e Padronização de Dados (Heurística #4)
> [!IMPORTANT]
> Os usuários não devem se perguntar se palavras, situações ou ações diferentes significam a mesma coisa.

* **Segurança e Isolamento de Contas (Vulnerabilidade Crítica)**: No [ProductFormSheet.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/library/ProductFormSheet.tsx#L173), a criação de produtos na biblioteca envia um ID de conta estático (`const accountId = "41456060-7f1a-46d8-9769-5ada9733fe97"`), que foi criado para testes/seed. Isso significa que **todos os usuários da plataforma salvarão itens sob a mesma conta**, misturando dados e criando uma brecha gravíssima de vazamento de dados corporativos entre clientes (Multi-tenancy Leakage).
* **Hardcode de Regras de Negócio no Front-end**: O limite de 2 projetos ativos do Plano Solo está fixado diretamente no código da interface ([Projects page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/projects/page.tsx#L62-L67) e [Dashboard page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx#L164)). Se o plano do usuário for expandido no banco de dados, a interface continuará bloqueando a criação de novos projetos, exigindo alteração no código-fonte.

---

## 3. Análise de Layout e Consistência Visual (UI)

### 3.1. Arquitetura de Estilização e Padronização Visual
* **Desvio de Variáveis CSS Semânticas**:
  * No componente [LoginPage.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/auth/login/page.tsx#L196), o botão de login possui cores injetadas estaticamente (`bg-[#008080] hover:bg-[#008080]/90`).
  * No diálogo financeiro ([QuickEntryDialog.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx#L238)), as cores de submit de receita/despesa são forçadas com classes estáticas `bg-emerald-600` e `bg-red-600`.
  * *Impacto*: Alterações globais de marca exigirirão varreduras manuais e substituições inline no código em vez de serem controladas diretamente nas variáveis CSS do tema global ([globals.css](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/globals.css)).

### 3.2. Contraste de Cores e Acessibilidade Visual (WCAG AA)
> [!CAUTION]
> Para atender ao nível AA de acessibilidade, o contraste mínimo recomendado entre o texto e o fundo deve ser de no mínimo 4.5:1 para texto normal.

* **Contraste no Modo Escuro (Dark Mode)**: A cor primária `--primary` (Teal `#008080` / HSL 180 100% 25.1%) permanece idêntica nos temas claro e escuro ([globals.css#L24](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/globals.css#L24) e [globals.css#L62](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/globals.css#L62)). No tema escuro, a combinação de texto Teal ou bordas de foco Teal contra o fundo escuro (`#030712`) gera um contraste de apenas **4.25:1**, dificultando a leitura de textos secundários e status.
* **Contrastes Críticos de Alertas**: A combinação de texto e fundo para alertas de "Slot Indisponível" ([UpgradeAlertModal.tsx#L21](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/UpgradeAlertModal.tsx#L21)) e status de "DNA Pendente" ([EnvironmentCard.tsx#L86](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/environments/EnvironmentCard.tsx#L86)) usa a classe Tailwind `text-amber-600 bg-amber-50`. Essa relação possui uma taxa de contraste de **2.91:1**, o que inviabiliza a leitura para pessoas com baixa acuidade visual.

### 3.3. Inconsistência de Marca (Branding)
* O widget flutuante de chat integrado à interface ([GlobalChatWidget.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/layout/GlobalChatWidget.tsx)) exibe em seu cabeçalho e mock de conversação a designação **"Assistente Ecowe"** (linhas 23 e 68). Isso expõe um vestígio de código de um projeto anterior (Ecowe) que não foi renomeado para a marca atual (Arch Smart).

### 3.4. Layout e Grade de Responsividade
* **Padding Assimétrico**: O componente principal de layout [AppShell.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/layout/AppShell.tsx#L133) impõe uma margem direita de `xl:pr-32` para telas muito grandes. Essa margem empurra e deforma o painel principal assimetricamente, criando um vazio desnecessário do lado direito.
* **Gargalo de Grade Móvel (Library Grid)**: O grid de imagens de produtos recentes no painel de controle do dashboard ([page.tsx#L458](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx#L458)) está travado em `grid-cols-2` sem media queries para aparelhos menores, fazendo com que textos e tags de preço fiquem espremidos em telas mobile menores que 360px.
* **Performance de Imagem (Layout Shift)**: A renderização de cards de produtos no dashboard usa a tag nativa `<img>` ([page.tsx#L464](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx#L464)) em vez do componente `<Image />` do Next.js, gerando avisos de compilação, layout shifts ao renderizar imagens em conexões lentas e consumo desnecessário de dados móveis por falta de compressão automática.

---

## 4. Acessibilidade Básica (A11y) e SEO Técnico

### 4.1. Navegação Semântica por Leitores de Tela
* **Ausência de Propriedades `htmlFor` e `id`**: O formulário de finanças ([QuickEntryDialog.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx#L150-L184)) possui elementos `<label>` sem vinculação semântica com os campos `<Input>`. Isso impede leitores de tela de lerem a descrição correspondente do campo e faz com que cliques na etiqueta não deem foco ao input.
* **Falta de ARIA Labels em Inputs de Dimensões**: As caixas de medição de móveis no formulário de cadastro ([ProductFormSheet.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/library/ProductFormSheet.tsx#L328-L364)) não utilizam atributos `aria-label` ou `aria-labelledby`, impedindo a leitura correta das siglas de medição pelos softwares de voz.

### 4.2. Navegação por Teclado (Keyboard Nav)
* **Elementos Ocultos por Hover sem Foco**: O botão de menu `MoreVertical` no card de ambiente ([EnvironmentCard.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/environments/EnvironmentCard.tsx#L62)) está estilizado com `opacity-0 group-hover:opacity-100`. Como a interface oculta o componente sem aplicar classes de foco (como `focus:opacity-100` or `group-focus-within:opacity-100`), usuários de navegação por teclado não enxergam as opções de edição ao navegar via tabulação.
* **Bloqueio de Foco (tabIndex={-1})**: O botão de alternância de visualização da senha na tela de login ([LoginPage.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/auth/login/page.tsx#L173)) está marcado com `tabIndex={-1}`. Com isso, usuários que utilizam teclado são incapazes de acionar o recurso para validar a senha antes do submit.

### 4.3. Parâmetro de Idioma HTML (SEO e Acessibilidade)
* O arquivo principal de layout de páginas ([layout.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/layout.tsx#L29)) declara a linguagem da página como `<html lang="en"`. Como o aplicativo está traduzido e estruturado para o português brasileiro (pt-BR), essa marcação prejudica a indexação de mecanismos de busca locais (SEO) e confunde leitores de tela, que tentam pronunciar as palavras em português usando as regras fonéticas do inglês.

---

## 5. Matriz de Plano de Ação (Documento para o Time)

A tabela a seguir consolida todas as vulnerabilidades identificadas. O **Impacto Percebido** e o **Esforço Estimado** foram definidos de forma cruzada para permitir priorização rápida (ex: corrigir primeiro itens de Alto Impacto e Baixo Esforço).

| Código | Componente / Arquivo Afetado | Categoria | Descrição do Problema no Código | Proposta Técnica de Solução | Impacto | Esforço |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UX-01** | [AppShell.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/layout/AppShell.tsx#L349) | Usabilidade | Título do cabeçalho é estático e ignora o `BreadcrumbProvider`. | Criar um componente de Breadcrumbs dinâmico que lê o caminho da rota atual com `usePathname`. | Médio | Baixo |
| **UX-02** | [dashboard/page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx#L153) | Usabilidade | Spinner de carregamento em tela cheia bloqueia a interação inteira do usuário. | Implementar Skeleton Screens simulando o formato dos cards de métricas usando o component de Skeleton do shadcn. | Médio | Baixo |
| **UX-03** | [dashboard/page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx#L164) e [projects/page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/projects/page.tsx#L62) | Usabilidade | Limite de projetos ativos (cota de 2 projetos) fixado de forma estática no front-end. | Buscar limites da assinatura dinamicamente a partir do endpoint de autenticação ou perfil do usuário. | Alto | Médio |
| **UX-04** | [projects/page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/projects/page.tsx#L16) | Usability | URL de API absoluta do ambiente local (`http://127.0.0.1:8000`) fixada no código do Server Component. | Substituir a string fixa por `process.env.NEXT_PUBLIC_API_URL` ou usar o utilitário `apiUrl`. | Alto | Baixo |
| **UX-05** | [UpgradeAlertModal.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/UpgradeAlertModal.tsx#L38) | Usabilidade | Uso de tag de link nativa `<a>` para redirecionamento financeiro, causando reload completo da página. | Substituir a tag nativa `<a>` pela importação do `<Link>` do `next/link`. | Médio | Baixo |
| **UX-06** | [EnvironmentCard.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/environments/EnvironmentCard.tsx#L27) | Usabilidade | Validação de remoção de ambiente depende da caixa de aviso nativa `confirm(...)` do navegador. | Substituir por um popup estilizado com o componente `<AlertDialog>` já configurado na biblioteca UI. | Médio | Baixo |
| **UX-07** | [ProductFormSheet.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/library/ProductFormSheet.tsx#L173) | Usabilidade / Segurança | Cadastro de produto com conta fixa (`accountId`) gerada no script de sementes (seed). | Extrair a informação de conta atual através do cookie de sessão ativa do Supabase integrado na chamada de requisição. | Alto | Médio |
| **UX-08** | [ProductFormSheet.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/library/ProductFormSheet.tsx#L328) | Usabilidade | Rótulos de Largura, Altura e Profundidade ocultos logo após a digitação por dependerem de placeholders. | Adicionar pequenas legendas textuais fixas acima de cada caixa de dimensão. | Médio | Baixo |
| **UX-09** | [QuickEntryDialog.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx#L63) | Usabilidade | Erros de validação do formulário financeiro avisados via toast após submit, sem feedbacks inline na tela. | Implementar validação via formulário controlado pelo `react-hook-form` com validação de esquema do `zod`. | Médio | Médio |
| **UX-10** | [QuickEntryDialog.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx#L160) | Usabilidade | Input financeiro do tipo `number` aceitando digitação bruta de decimais sem máscara local adaptada. | Injetar uma máscara monetária ou converter o input para controle de texto com manipulação de floats. | Médio | Baixo |
| **UI-01** | [globals.css](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/globals.css#L62) e [LoginPage.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/auth/login/page.tsx#L196) | Layout | Baixo contraste de cor Teal (`#008080`) contra o fundo escuro do modo escuro. | Ajustar a variável CSS de cor primária Teal no tema `.dark` para um tom mais claro e vívido. | Alto | Baixo |
| **UI-02** | [UpgradeAlertModal.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/UpgradeAlertModal.tsx#L21) e [EnvironmentCard.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/environments/EnvironmentCard.tsx#L86) | Layout | Combinação de texto e fundo de status `text-amber-600 bg-amber-50` falha em contraste (2.91:1). | Ajustar as classes de estilo para aumentar o tom do texto em alertas (ex: mudar para `text-amber-900`). | Alto | Baixo |
| **UI-03** | [AppShell.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/layout/AppShell.tsx#L133) | Layout | Padding-right exagerado (`xl:pr-32`) distorce o layout e espreme colunas em telas grandes. | Padronizar as margens com paddings simétricos horizontais nos pontos de quebra médios e grandes. | Médio | Baixo |
| **UI-04** | [GlobalChatWidget.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/layout/GlobalChatWidget.tsx#L23) | Layout | Texto do chatbot cita "Assistente Ecowe" em vez de "Arch Smart" (erro de branding). | Fazer busca e substituição textual global substituindo referências a "Ecowe" por "Arch Smart". | Alto | Baixo |
| **UI-05** | [dashboard/page.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx#L464) | Layout | Uso de tag nativa `<img>` em vez de `<Image />` do Next.js gera atrasos e layout shifts (CLS). | Refatorar os cards de biblioteca de imagens para usar o componente `<Image />` com propriedades adequadas. | Médio | Baixo |
| **A11y-01** | [LoginPage.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/auth/login/page.tsx#L173) | Acessibilidade | Botão de alternar visualização de senha possui `tabIndex={-1}`, bloqueando navegação por teclado. | Remover o atributo `tabIndex={-1}` e habilitar o foco completo pelo fluxo padrão de tabulação. | Alto | Baixo |
| **A11y-02** | [QuickEntryDialog.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx#L150) | Acessibilidade | Falta de associação semântica entre tags `<label>` e tags `<Input>`. | Injetar atributos de vinculação semântica `id` e `htmlFor` nos campos de formulário. | Alto | Baixo |
| **A11y-03** | [EnvironmentCard.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/components/projects/environments/EnvironmentCard.tsx#L62) | Acessibilidade | Botão de opções secundárias invisível sem hover, impossibilitando foco por teclado e toques no mobile. | Ajustar classes de foco para que o botão apareça ao ser focado via tabulação (`focus:opacity-100`). | Alto | Baixo |
| **SEO-01** | [layout.tsx](file:///c:/Users/brenn/Downloads/01-Arch-Smart-main/ArchSmart-web/src/app/layout.tsx#L29) | Acessibilidade | Atributo lang do HTML definido como "en" em uma plataforma construída em português. | Alterar o atributo no HTML de `lang="en"` para `lang="pt-BR"`. | Médio | Baixo |

---

## 6. Próximos Passos Recomendados para a Equipe

1. **Correção de Segurança Imediata (Prioridade Zero)**: Corrigir o vazamento de multi-tenancy no `ProductFormSheet.tsx` (código **UX-07**), substituindo o `accountId` hardcoded pelo ID retornado na validação da sessão do Supabase.
2. **Ajuste de Acessibilidade Visual e Branding (Quick Wins)**: Corrigir os contrastes de cores no arquivo `globals.css` (código **UI-01** e **UI-02**), as menções à marca antiga no chat (código **UI-04**) e o idioma na raiz do site (código **SEO-01**). São correções simples que tomam poucos minutos e garantem melhorias perceptíveis instantâneas.
3. **Refatoração de UX e Performance**: Substituir as telas de carregamento travadas por esqueletos de tela (*Skeletons*), e adicionar máscaras e validações inline nas transações financeiras e formulários de projetos para reduzir chamadas de erro de banco de dados por dados mal formatados.
