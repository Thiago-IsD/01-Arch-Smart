"""
Seed com volume realista.

Substitui os quatro scripts antigos (seed_clipper.py, seed_mock.py,
seed_products.py, seed_tokstok.py) por um script unico e parametrizado.
E contra o volume gerado aqui que o orcamento de performance de cada tela
e medido nas Secoes 6 e 8 — medir com tres produtos na biblioteca foi o
que deixou a lentidao da plataforma passar despercebida.

Uso:
    DATABASE_URL=postgresql://... python tools/seed.py \
        --projetos 5 --ambientes 25 --biblioteca 300 --itens 500

--ambientes e --itens sao totais, distribuidos entre os projetos e
orcamentos respectivamente — nao valores por projeto.

Determinismo: random.seed(42) e uma data de referencia fixa (nao
datetime.utcnow()) fazem duas execucoes produzirem o mesmo banco, para que
uma medicao de performance seja comparavel com a da semana anterior.

Idempotencia: a conta "Seed — volume realista" e criada ou reaproveitada
por nome; a cada execucao, os dados de volume dessa conta (produtos,
clientes, projetos, ambientes, orcamentos, itens, opcoes, e qualquer
apresentacao/lancamento/evento/slot que alguem tenha criado em cima deles
no staging) sao apagados e recriados do zero — reescrita, nao deteccao de
duplicata. As tabelas de referencia globais (product_origins,
product_states) e os usuarios do seed nunca sao apagados, so
reaproveitados por chave natural.

Guarda de producao: julga a MESMA URL que app.db.session vai usar para
criar o engine — settings.DATABASE_URL, resolvida por
app/core/config.py (env var OU, na ausencia dela, o arquivo .env). Nunca
julga os.environ["DATABASE_URL"] diretamente: uma variavel nao exportada
nao e ausencia de URL, e o pydantic cai silenciosamente para o .env nesse
caso — que nesta maquina aponta para o pooler do Supabase de producao.
"""
from __future__ import annotations

import argparse
import os
import random
import sys
import uuid
from datetime import datetime, timedelta

# Permite "python tools/seed.py" de qualquer cwd: adiciona a raiz de
# ArchSmart-api (pai de tools/) ao sys.path antes de qualquer "import app".
# Nao toca o banco — seguro rodar antes da guarda de producao.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# Guarda de producao — precisa ser a PRIMEIRA coisa que main() chama, antes
# de abrir qualquer sessao ou engine (app.db.session cria o engine na
# importacao). Mesma guarda de tests/conftest.py: um seed de centenas de
# linhas rodado por engano contra o banco do time nao tem desfazer.
#
# A guarda julga a URL RESOLVIDA (resolver_url_e_origem, abaixo), nunca
# os.environ["DATABASE_URL"] direto — ver o docstring do modulo para o
# porque. Resolver a URL exige "from app.core.config import settings", mas
# so importar config nao abre conexao (create_engine e lazy, e so
# app.db.session chama create_engine) — entao isso e seguro de fazer antes
# da guarda liberar o resto do script.
# ---------------------------------------------------------------------------
HOSTS_PROIBIDOS = ("supabase.co", "pooler.supabase.com", "render.com", "amazonaws.com")


def resolver_url_e_origem() -> tuple[str, str]:
    """
    Resolve a URL do banco exatamente como a aplicacao resolve — importando
    app.core.config e lendo settings.DATABASE_URL, o mesmo valor que
    app.db.session usa para criar o engine — e nao os.environ direto.
    Devolve tambem de onde ela veio, para a mensagem de recusa deixar claro
    se foi a variavel exportada ou o fallback do .env.
    """
    from app.core.config import settings

    url = settings.DATABASE_URL
    if os.environ.get("DATABASE_URL"):
        origem = "variavel de ambiente DATABASE_URL"
    else:
        origem = "arquivo .env (nenhuma DATABASE_URL exportada no ambiente)"
    return url, origem


def recusar_producao(url: str, forcado: bool, origem: str) -> None:
    url_normalizada = url.lower()
    achados = [h for h in HOSTS_PROIBIDOS if h in url_normalizada]
    if achados and not forcado:
        sys.exit(
            f"Recusando rodar: DATABASE_URL contem {', '.join(achados)}, que e "
            f"host gerenciado.\n  URL: {url!r}\n  Origem: {origem}\n"
            "Se e realmente o que voce quer, passe --eu-sei-o-que-estou-fazendo."
        )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed com volume realista para a conta de teste de performance."
    )
    parser.add_argument("--projetos", type=int, default=5, help="Total de projetos.")
    parser.add_argument(
        "--ambientes", type=int, default=25, help="Total de ambientes, distribuidos entre os projetos."
    )
    parser.add_argument(
        "--biblioteca", type=int, default=300, help="Total de produtos na biblioteca da conta."
    )
    parser.add_argument(
        "--itens", type=int, default=500, help="Total de itens de orcamento, distribuidos entre os projetos."
    )
    parser.add_argument(
        "--eu-sei-o-que-estou-fazendo",
        action="store_true",
        default=False,
        help="Ignora a guarda de producao (host gerenciado). Use com cuidado extremo.",
    )
    return parser.parse_args(argv)


NOME_CONTA = "Seed — volume realista"

# Data de referencia fixa (nao datetime.utcnow()): os created_at gerados
# variam ao redor dela via random.seed(42), para que duas execucoes do
# script produzam o mesmo conteudo, nao so os mesmos totais.
DATA_REFERENCIA = datetime(2026, 8, 24, 12, 0, 0)

USUARIOS_SEED = [
    ("ana.arquiteta@seed.arqsmart.local", "Ana Arquiteta"),
    ("bruno.projetista@seed.arqsmart.local", "Bruno Projetista"),
    ("carla.orcamentista@seed.arqsmart.local", "Carla Orcamentista"),
]

# Produtos-ancora: nomes e URLs reais preservados dos scripts antigos
# (seed_products.py e seed_tokstok.py) em vez de descartados.
PRODUTOS_ANCORA = [
    {
        "name": "Cadeira Eames com Base de Madeira DSW - Branca",
        "store": "Herman Miller",
        "category": "Cadeiras",
        "price": 1250.00,
        "image_url": "https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&q=80&w=500",
    },
    {
        "name": "Sofa Cama 3 Lugares Malaquita Preto",
        "store": "Tok&Stok",
        "category": "Sofás",
        "price": None,
        "source_url": "https://www.tokstok.com.br/sofa-cama-3-lugares-malaquita-preto-marad/p?idsku=427782",
        "image_url": "https://tokstok.vtexassets.com/arquivos/ids/6234057-798-798",
    },
]

CATEGORIAS = [
    "Cadeiras",
    "Poltronas",
    "Sofás",
    "Mesas",
    "Luminárias",
    "Decoração",
    "Revestimentos",
    "Pisos",
    "Tintas",
    "Metais e Louças",
]
LOJAS = [
    "Herman Miller",
    "Westwing",
    "Mobly",
    "Tok&Stok",
    "Etna",
    "Arquivo Contemporâneo",
    "Portobello",
    "Deca",
    "Tigre",
    "Suvinil",
]
ADJETIVOS_PRODUTO = ["Luxo", "Standard", "Premium", "Clássico", "Contemporâneo", "Minimalista"]
CORES_PRODUTO = ["Branco", "Preto", "Bege", "Cinza", "Nogueira", "Carvalho"]

# Categorias vendidas por area de cobertura (m2/L, m2/caixa) em vez de por
# unidade — ganham yield_factor e nao ganham largura/altura/profundidade.
CATEGORIAS_POR_RENDIMENTO = {"Revestimentos", "Pisos", "Tintas"}

NOMES_CLIENTES = [
    "Família Almeida",
    "Família Souza",
    "Família Ribeiro",
    "Família Costa",
    "Família Martins",
    "Família Tanaka",
    "Família Nogueira",
    "Escritório Vega Empreendimentos",
    "Construtora Horizonte",
    "Studio Bellini Arquitetura",
]

TIPOS_PROJETO = [
    "Residência",
    "Apartamento",
    "Cobertura",
    "Studio",
    "Loft",
    "Sala Comercial",
    "Clínica",
    "Escritório",
]
BAIRROS_PROJETO = [
    "Jardins",
    "Vila Madalena",
    "Moema",
    "Pinheiros",
    "Itaim Bibi",
    "Higienópolis",
    "Perdizes",
    "Brooklin",
]
STATUS_PROJETO = ["ACTIVE", "ACTIVE", "ACTIVE", "COMPLETED", "PAUSED"]
TIPOS_SERVICO = ["Projeto Completo", "Consultoria", "Decoração", "Reforma"]
METODOS_PAGAMENTO = ["STANDARD", "PIX", "BOLETO"]

AMBIENTES_NOMES = [
    "Sala de Estar",
    "Sala de Jantar",
    "Cozinha",
    "Quarto Casal",
    "Quarto Infantil",
    "Suíte Master",
    "Banheiro Social",
    "Banheiro Suíte",
    "Escritório",
    "Varanda Gourmet",
    "Lavanderia",
    "Hall de Entrada",
    "Closet",
    "Home Theater",
    "Área de Serviço",
    "Living Integrado",
    "Quarto de Hóspedes",
]
TIPOS_AMBIENTE = ["Interna Seca", "Interna Molhada", "Externa"]

MOTIVOS_REJEICAO = [
    "Cliente preferiu outro acabamento.",
    "Fora do orçamento aprovado.",
    "Prazo de entrega incompatível com a obra.",
]


def distribuir(total: int, baldes: int, rng) -> list[int]:
    """
    Distribui `total` unidades entre `baldes` grupos, com pelo menos 1 por
    grupo quando total >= baldes, e variacao aleatoria em vez de
    total // baldes puro (uma biblioteca real nao tem os mesmos 5 ambientes
    em cada projeto).
    """
    if baldes <= 0:
        return []
    contagens = [0] * baldes
    linha_de_base = min(total, baldes)
    for i in range(linha_de_base):
        contagens[i] += 1
    for _ in range(total - linha_de_base):
        contagens[rng.randrange(baldes)] += 1
    rng.shuffle(contagens)
    return contagens


def data_aleatoria(rng, dias_maximos: int = 400) -> datetime:
    return DATA_REFERENCIA - timedelta(days=rng.randint(0, dias_maximos))


def gerar_dimensoes_e_rendimento(categoria: str, rng):
    """Retorna (dimensions, yield_factor) coerentes com a categoria."""
    if categoria in CATEGORIAS_POR_RENDIMENTO:
        return None, round(rng.uniform(0.8, 2.5), 2)
    if categoria in ("Luminárias", "Decoração", "Metais e Louças"):
        dimensoes = {
            "width": rng.randint(10, 40),
            "height": rng.randint(10, 60),
            "depth": rng.randint(10, 40),
            "unit": "cm",
        }
        return dimensoes, None
    dimensoes = {
        "width": rng.randint(40, 220),
        "height": rng.randint(40, 110),
        "depth": rng.randint(40, 100),
        "unit": "cm",
    }
    return dimensoes, None


def obter_ou_criar_conta(db, Account):
    conta = db.query(Account).filter(Account.name == NOME_CONTA).first()
    if conta is not None:
        return conta
    conta = Account(
        id=uuid.uuid4(),
        name=NOME_CONTA,
        company_name="Arq Smart — Ambiente de Volume",
        is_active=True,
    )
    db.add(conta)
    return conta


def obter_ou_criar_usuarios(db, User, conta):
    usuarios = []
    for email, nome in USUARIOS_SEED:
        usuario = db.query(User).filter(User.email == email).first()
        if usuario is None:
            usuario = User(
                id=uuid.uuid4(),
                account_id=conta.id,
                email=email,
                full_name=nome,
                role="ARCHITECT",
            )
            db.add(usuario)
        usuarios.append(usuario)
    return usuarios


def obter_ou_criar_origens(db, ProductOrigin, ProductOriginType):
    nomes = {
        ProductOriginType.MANUAL: "Manual",
        ProductOriginType.WEB_CLIPPER: "Web Clipper",
        ProductOriginType.SHOPPING_HUB: "Shopping Hub",
    }
    origens = {}
    for tipo, nome in nomes.items():
        origem = db.query(ProductOrigin).filter(ProductOrigin.type == tipo).first()
        if origem is None:
            origem = ProductOrigin(id=uuid.uuid4(), name=nome, type=tipo)
            db.add(origem)
        origens[tipo] = origem
    return origens


def obter_ou_criar_estados(db, ProductState, ProductStateStatus):
    nomes = {
        ProductStateStatus.CAPTURED: "Capturado",
        ProductStateStatus.NORMALIZED: "Normalizado",
        ProductStateStatus.INACTIVE: "Inativo",
    }
    estados = {}
    for status, nome in nomes.items():
        estado = db.query(ProductState).filter(ProductState.status == status).first()
        if estado is None:
            estado = ProductState(id=uuid.uuid4(), name=nome, status=status)
            db.add(estado)
        estados[status] = estado
    return estados


def limpar_dados_de_volume(
    db,
    conta_id,
    Product,
    Client,
    Project,
    Environment,
    Budget,
    BudgetItem,
    ItemOption,
    Presentation,
    PresentationEnvironment,
    PresentationAcceptance,
    PresentationComment,
    FinancialEntry,
    Event,
    ProjectSlot,
):
    """
    Apaga os dados de volume desta conta antes de recriar — e assim que o
    seed fica idempotente: rodar duas vezes reescreve, nao duplica.
    Ordem inversa a de criacao, para respeitar as chaves estrangeiras.

    Alem do que o proprio seed cria, sete tabelas dependem de
    projects/environments/presentations SEM ON DELETE CASCADE no banco —
    confirmado consultando pg_constraint.confdeltype, nao supondo a partir
    do modelo (o cascade Python de Presentation.environments/comments/
    acceptance so roda em session.delete() por instancia, nunca em
    Query.delete() em lote, que e o que este script usa):
    presentations, presentation_acceptances, presentation_comments,
    presentation_environments, financial_entries, events, project_slots.
    Se alguem usar o staging e criar uma apresentacao ou lancamento
    financeiro num projeto do seed, a proxima execucao quebra com
    ForeignKeyViolation a nao ser que essas linhas tambem sejam apagadas
    aqui — sempre escopadas aos projects/environments desta conta, nunca
    de outra conta.

    (item_options->budget_items, budget_items->budgets,
    budget_items->environments e environment_dnas->environments JA tem
    ON DELETE CASCADE no banco — as queries explicitas abaixo continuam
    corretas mesmo assim, so redundantes nesses casos.)
    """
    projeto_ids = [pid for (pid,) in db.query(Project.id).filter(Project.account_id == conta_id)]
    ambiente_ids = (
        [eid for (eid,) in db.query(Environment.id).filter(Environment.project_id.in_(projeto_ids))]
        if projeto_ids
        else []
    )
    orcamento_ids = (
        [bid for (bid,) in db.query(Budget.id).filter(Budget.project_id.in_(projeto_ids))]
        if projeto_ids
        else []
    )
    item_ids = (
        [iid for (iid,) in db.query(BudgetItem.id).filter(BudgetItem.budget_id.in_(orcamento_ids))]
        if orcamento_ids
        else []
    )
    apresentacao_ids = (
        [aid for (aid,) in db.query(Presentation.id).filter(Presentation.project_id.in_(projeto_ids))]
        if projeto_ids
        else []
    )

    if item_ids:
        db.query(ItemOption).filter(ItemOption.budget_item_id.in_(item_ids)).delete(synchronize_session=False)
    if orcamento_ids:
        db.query(BudgetItem).filter(BudgetItem.budget_id.in_(orcamento_ids)).delete(synchronize_session=False)
    if projeto_ids:
        db.query(Budget).filter(Budget.project_id.in_(projeto_ids)).delete(synchronize_session=False)

    if apresentacao_ids:
        db.query(PresentationComment).filter(
            PresentationComment.presentation_id.in_(apresentacao_ids)
        ).delete(synchronize_session=False)
        db.query(PresentationAcceptance).filter(
            PresentationAcceptance.presentation_id.in_(apresentacao_ids)
        ).delete(synchronize_session=False)
    if apresentacao_ids or ambiente_ids:
        db.query(PresentationEnvironment).filter(
            PresentationEnvironment.presentation_id.in_(apresentacao_ids)
            | PresentationEnvironment.environment_id.in_(ambiente_ids)
        ).delete(synchronize_session=False)
    if projeto_ids:
        db.query(Presentation).filter(Presentation.project_id.in_(projeto_ids)).delete(synchronize_session=False)
        db.query(FinancialEntry).filter(FinancialEntry.project_id.in_(projeto_ids)).delete(synchronize_session=False)
        db.query(Event).filter(Event.project_id.in_(projeto_ids)).delete(synchronize_session=False)
        db.query(ProjectSlot).filter(ProjectSlot.project_id.in_(projeto_ids)).delete(synchronize_session=False)
        db.query(Environment).filter(Environment.project_id.in_(projeto_ids)).delete(synchronize_session=False)
    db.query(Project).filter(Project.account_id == conta_id).delete(synchronize_session=False)
    db.query(Client).filter(Client.account_id == conta_id).delete(synchronize_session=False)
    db.query(Product).filter(Product.account_id == conta_id).delete(synchronize_session=False)
    db.flush()


def criar_biblioteca(db, Product, conta, origens, estados, quantidade, rng):
    origens_lista = list(origens.values())
    estados_lista = list(estados.values())
    produtos = []

    for ancora in PRODUTOS_ANCORA[:quantidade]:
        categoria = ancora.get("category", "Decoração")
        dimensoes, rendimento = gerar_dimensoes_e_rendimento(categoria, rng)
        produtos.append(
            Product(
                id=uuid.uuid4(),
                account_id=conta.id,
                origin_id=rng.choice(origens_lista).id,
                state_id=rng.choice(estados_lista).id,
                name=ancora["name"],
                store=ancora.get("store"),
                category=categoria,
                price=ancora.get("price"),
                cost_price=(ancora["price"] * 0.6) if ancora.get("price") else None,
                dimensions=dimensoes,
                yield_factor=rendimento,
                image_url=ancora.get("image_url"),
                source_url=ancora.get("source_url"),
                created_at=data_aleatoria(rng),
            )
        )

    restante = quantidade - len(produtos)
    for i in range(restante):
        categoria = rng.choice(CATEGORIAS)
        loja = rng.choice(LOJAS)
        preco = round(rng.uniform(80.0, 8000.0), 2)
        dimensoes, rendimento = gerar_dimensoes_e_rendimento(categoria, rng)
        nome = f"{categoria} {rng.choice(ADJETIVOS_PRODUTO)} {rng.choice(CORES_PRODUTO)} #{i + 1}"
        descricao = (
            f"{categoria} da {loja}, acabamento {rng.choice(CORES_PRODUTO).lower()}."
            if rng.random() < 0.7
            else None
        )
        produtos.append(
            Product(
                id=uuid.uuid4(),
                account_id=conta.id,
                origin_id=rng.choice(origens_lista).id,
                state_id=rng.choice(estados_lista).id,
                name=nome,
                description=descricao,
                store=loja,
                category=categoria,
                price=preco,
                cost_price=round(preco * rng.uniform(0.4, 0.7), 2),
                markup=round(rng.uniform(1.3, 2.5), 2),
                dimensions=dimensoes,
                yield_factor=rendimento,
                image_url=None,
                created_at=data_aleatoria(rng),
            )
        )

    db.add_all(produtos)
    return produtos


def criar_clientes(db, Client, conta, quantidade, rng):
    clientes = []
    for i in range(quantidade):
        nome_base = NOMES_CLIENTES[i % len(NOMES_CLIENTES)]
        sufixo = f" {i // len(NOMES_CLIENTES) + 1}" if i >= len(NOMES_CLIENTES) else ""
        clientes.append(
            Client(
                id=uuid.uuid4(),
                account_id=conta.id,
                name=f"{nome_base}{sufixo}",
                email=f"cliente{i + 1}@seed.arqsmart.local",
                phone=f"(11) 9{rng.randint(1000, 9999)}-{rng.randint(1000, 9999)}",
            )
        )
    db.add_all(clientes)
    return clientes


def criar_projetos(db, Project, conta, clientes, quantidade, rng):
    projetos = []
    for i in range(quantidade):
        tipo = rng.choice(TIPOS_PROJETO)
        bairro = rng.choice(BAIRROS_PROJETO)
        projetos.append(
            Project(
                id=uuid.uuid4(),
                account_id=conta.id,
                client_id=rng.choice(clientes).id,
                name=f"{tipo} {bairro} #{i + 1}",
                status=rng.choice(STATUS_PROJETO),
                service_type=rng.choice(TIPOS_SERVICO),
                service_value=round(rng.uniform(5000.0, 120000.0), 2),
                payment_installments=rng.randint(1, 12),
                payment_method=rng.choice(METODOS_PAGAMENTO),
                created_at=data_aleatoria(rng),
            )
        )
    db.add_all(projetos)
    return projetos


def criar_ambientes(db, Environment, projetos, quantidade_total, rng):
    contagens = distribuir(quantidade_total, len(projetos), rng)
    ambientes = []
    ambientes_por_projeto: dict = {p.id: [] for p in projetos}
    for projeto, contagem in zip(projetos, contagens):
        for _ in range(contagem):
            ambiente = Environment(
                id=uuid.uuid4(),
                project_id=projeto.id,
                name=rng.choice(AMBIENTES_NOMES),
                type=rng.choice(TIPOS_AMBIENTE),
                created_at=data_aleatoria(rng),
            )
            ambientes.append(ambiente)
            ambientes_por_projeto[projeto.id].append(ambiente)
    db.add_all(ambientes)
    return ambientes, ambientes_por_projeto


def criar_orcamentos(db, Budget, projetos):
    orcamentos = []
    orcamento_por_projeto = {}
    for projeto in projetos:
        orcamento = Budget(id=uuid.uuid4(), project_id=projeto.id, total_value=None)
        orcamentos.append(orcamento)
        orcamento_por_projeto[projeto.id] = orcamento
    db.add_all(orcamentos)
    return orcamentos, orcamento_por_projeto


def criar_itens_orcamento(db, BudgetItem, RuleType, projetos, orcamento_por_projeto, ambientes_por_projeto, quantidade_total, rng):
    contagens = distribuir(quantidade_total, len(projetos), rng)
    tipos_regra = list(RuleType)
    itens = []
    for projeto, contagem in zip(projetos, contagens):
        orcamento = orcamento_por_projeto[projeto.id]
        ambientes_do_projeto = ambientes_por_projeto[projeto.id]
        for _ in range(contagem):
            ambiente = rng.choice(ambientes_do_projeto) if ambientes_do_projeto else None
            item = BudgetItem(
                id=uuid.uuid4(),
                budget_id=orcamento.id,
                environment_id=ambiente.id if ambiente else None,
                rule_type=rng.choice(tipos_regra),
                manual_quantity=rng.randint(1, 50) if rng.random() < 0.5 else None,
                loss_factor=round(rng.uniform(5.0, 15.0), 1),
            )
            itens.append(item)
    db.add_all(itens)
    return itens


def criar_opcoes_item(db, ItemOption, itens, produtos, rng):
    opcoes = []
    if not produtos:
        # --biblioteca 0: nao ha produto para vincular a nenhuma opcao.
        return opcoes
    for item in itens:
        quantidade = rng.randint(1, min(3, len(produtos)))
        escolhidos = rng.sample(produtos, quantidade)
        for indice, produto in enumerate(escolhidos):
            selecionado = indice == 0
            if selecionado:
                status = "APPROVED" if rng.random() < 0.6 else "PENDING"
                motivo = None
            else:
                status = rng.choice(["PENDING", "REJECTED"])
                motivo = rng.choice(MOTIVOS_REJEICAO) if status == "REJECTED" else None
            opcoes.append(
                ItemOption(
                    id=uuid.uuid4(),
                    budget_item_id=item.id,
                    product_id=produto.id,
                    is_selected=selecionado,
                    approval_status=status,
                    rejection_reason=motivo,
                    created_at=data_aleatoria(rng),
                )
            )
    db.add_all(opcoes)
    return opcoes


def imprimir_resumo(db, tabelas) -> None:
    print("\nResumo contado (SELECT count(*) por tabela, nao contador em memoria):")
    largura = max(len(nome) for nome, _ in tabelas)
    for nome, modelo in tabelas:
        total = db.query(modelo).count()
        print(f"  {nome.ljust(largura)} : {total}")


def main() -> None:
    args = parse_args()

    url, origem = resolver_url_e_origem()
    recusar_producao(url, args.eu_sei_o_que_estou_fazendo, origem)

    # Import tardio, de proposito: SessionLocal usa o MESMO settings.DATABASE_URL
    # ja resolvido em resolver_url_e_origem() (settings e um singleton lido uma
    # unica vez) — guarda e engine nunca podem divergir porque os dois leem da
    # mesma fonte.
    from app.db.session import SessionLocal
    from app.models.all_models import (
        Account,
        User,
        ProductOrigin,
        ProductOriginType,
        ProductState,
        ProductStateStatus,
        Product,
        Client,
        Project,
        Environment,
        Budget,
        BudgetItem,
        ItemOption,
        RuleType,
        Presentation,
        PresentationEnvironment,
        PresentationAcceptance,
        PresentationComment,
        FinancialEntry,
        Event,
        ProjectSlot,
    )

    # random.seed(42) fixo (nao um random.Random() local): duas execucoes
    # do script tem que gerar exatamente a mesma sequencia de escolhas.
    random.seed(42)
    rng = random

    db = SessionLocal()
    try:
        conta = obter_ou_criar_conta(db, Account)
        db.flush()

        obter_ou_criar_usuarios(db, User, conta)
        origens = obter_ou_criar_origens(db, ProductOrigin, ProductOriginType)
        estados = obter_ou_criar_estados(db, ProductState, ProductStateStatus)
        db.flush()

        limpar_dados_de_volume(
            db,
            conta.id,
            Product,
            Client,
            Project,
            Environment,
            Budget,
            BudgetItem,
            ItemOption,
            Presentation,
            PresentationEnvironment,
            PresentationAcceptance,
            PresentationComment,
            FinancialEntry,
            Event,
            ProjectSlot,
        )

        produtos = criar_biblioteca(db, Product, conta, origens, estados, args.biblioteca, rng)
        clientes = criar_clientes(db, Client, conta, max(1, args.projetos), rng)
        db.flush()

        projetos = criar_projetos(db, Project, conta, clientes, args.projetos, rng)
        db.flush()

        ambientes, ambientes_por_projeto = criar_ambientes(db, Environment, projetos, args.ambientes, rng)
        orcamentos, orcamento_por_projeto = criar_orcamentos(db, Budget, projetos)
        db.flush()

        itens = criar_itens_orcamento(
            db, BudgetItem, RuleType, projetos, orcamento_por_projeto, ambientes_por_projeto, args.itens, rng
        )
        db.flush()

        criar_opcoes_item(db, ItemOption, itens, produtos, rng)

        db.commit()

        tabelas = [
            ("accounts", Account),
            ("users", User),
            ("product_origins", ProductOrigin),
            ("product_states", ProductState),
            ("products", Product),
            ("clients", Client),
            ("projects", Project),
            ("environments", Environment),
            ("budgets", Budget),
            ("budget_items", BudgetItem),
            ("item_options", ItemOption),
        ]
        imprimir_resumo(db, tabelas)
    finally:
        db.close()


if __name__ == "__main__":
    main()
