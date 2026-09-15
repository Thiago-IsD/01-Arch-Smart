"""
Projetos: a lista, o detalhe e os ambientes nao consultam uma vez por linha.

Mesmo principio de `test_produtos_sem_n_mais_um.py`: quem carrega a garantia e
a CONSTANCIA (1 linha e 20 linhas custam o mesmo numero de consultas), mais um
teto com folga. Cada consulta e uma ida a rede, a 0,17 s na API implantada
(docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md). Antes desta
tarefa a lista gastava 12 consultas numa pagina de 5 projetos (13/09/2026):
`client` e `environments` carregados por linha.

`db.expunge_all()` antes de contar e obrigatorio: os objetos criados pelo teste
ficam na identity map, e um many-to-one (`Project.client`) resolvido por chave
primaria sai da identity map SEM ir ao banco — o N+1 ficaria invisivel aqui e
continuaria vivo na producao, onde nenhuma requisicao chega com o cliente ja
carregado.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Account, Client, Environment, EnvironmentDNA, Project
from tests.contador_de_queries import ContadorDeQueries


def _projetos(
    db: Session, conta: Account, quantos: int, ambientes: int = 2, status: str = "ACTIVE"
) -> list:
    """`quantos` projetos, cada um com o SEU cliente e `ambientes` ambientes com DNA."""
    ids = []
    for indice in range(quantos):
        cliente = Client(account_id=conta.id, name=f"Cliente {status} {indice}")
        db.add(cliente)
        db.flush()
        projeto = Project(
            account_id=conta.id, client_id=cliente.id, name=f"Projeto {status} {indice}", status=status
        )
        db.add(projeto)
        db.flush()
        for j in range(ambientes):
            ambiente = Environment(account_id=conta.id, project_id=projeto.id, name=f"Ambiente {j}")
            db.add(ambiente)
            db.flush()
            db.add(EnvironmentDNA(account_id=conta.id, environment_id=ambiente.id, floor_area=10.0))
        ids.append(projeto.id)
    db.flush()
    return ids


def _contar(db: Session, client, url: str):
    db.expunge_all()
    with ContadorDeQueries(db.connection()) as contador:
        resposta = client.get(url)
    assert resposta.status_code == 200, resposta.text
    return len(contador), resposta.json(), contador


def test_a_lista_nao_consulta_por_projeto(db: Session, conta_a, client_a):
    conta, _ = conta_a
    _projetos(db, conta, 1)
    com_um, corpo, _ = _contar(db, client_a, "/api/projects?page=1&size=1")
    assert len(corpo["items"]) == 1

    _projetos(db, conta, 19)
    com_vinte, corpo, contador = _contar(db, client_a, "/api/projects?page=1&size=20")
    assert len(corpo["items"]) == 20
    # Se o cliente ou a contagem sumissem da resposta, a contagem cairia e o
    # teste passaria por engano.
    assert all(item["client"] and item["client"]["name"] for item in corpo["items"])
    assert all(item["environments_count"] == 2 for item in corpo["items"])

    assert com_um == com_vinte, (
        f"a lista cresceu com a pagina: {com_um} para 1 projeto, {com_vinte} para 20.\n  "
        + contador.resumo()
    )
    # 1 contexto/entitlements (re-resolvido pela fixture client_a em toda
    # requisicao, fora do escopo desta tarefa) + 1 contagem + 1 pagina com
    # join do cliente + 1 contagem de ambientes agregada + 1 active_count.
    # Quem trocar a estrategia ajusta no mesmo commit.
    assert com_vinte <= 5, f"{com_vinte} consultas na lista:\n  " + contador.resumo()


def test_active_count_e_da_conta_inteira_e_nao_da_pagina(db: Session, conta_a, client_a):
    conta, _ = conta_a
    _projetos(db, conta, 3, ambientes=0, status="ACTIVE")
    _projetos(db, conta, 2, ambientes=0, status="COMPLETED")

    corpo = client_a.get("/api/projects?page=1&size=2").json()

    assert len(corpo["items"]) == 2
    assert corpo["active_count"] == 3


def test_active_count_ignora_a_busca(db: Session, conta_a, client_a):
    conta, _ = conta_a
    _projetos(db, conta, 2, ambientes=0, status="ACTIVE")

    corpo = client_a.get("/api/projects?search=nao-existe-nenhum").json()

    assert corpo["items"] == []
    assert corpo["active_count"] == 2


def test_active_count_ignora_outra_conta(db: Session, conta_a, conta_b, client_a):
    _projetos(db, conta_b[0], 4, ambientes=0)
    _projetos(db, conta_a[0], 1, ambientes=0)

    assert client_a.get("/api/projects").json()["active_count"] == 1


def test_o_detalhe_custa_o_mesmo_com_1_e_com_20_ambientes(db: Session, conta_a, client_a):
    conta, _ = conta_a
    [com_um_ambiente] = _projetos(db, conta, 1, ambientes=1)
    [com_vinte_ambientes] = _projetos(db, conta, 1, ambientes=20)

    c1, corpo1, _ = _contar(db, client_a, f"/api/projects/{com_um_ambiente}")
    c20, corpo20, contador = _contar(db, client_a, f"/api/projects/{com_vinte_ambientes}")

    assert corpo1["environments_count"] == 1 and corpo20["environments_count"] == 20
    assert corpo20["client"]["name"]
    assert c1 == c20, f"{c1} contra {c20}:\n  " + contador.resumo()
    # 1 contexto/entitlements + 1 obter do projeto + 1 ambientes (colecao,
    # so para o len de environments_count) + 1 cliente.
    assert c20 <= 4, f"{c20} consultas no detalhe:\n  " + contador.resumo()


def test_a_lista_de_ambientes_nao_consulta_um_dna_por_ambiente(db: Session, conta_a, client_a):
    conta, _ = conta_a
    [com_um] = _projetos(db, conta, 1, ambientes=1)
    [com_vinte] = _projetos(db, conta, 1, ambientes=20)

    c1, corpo1, _ = _contar(db, client_a, f"/api/projects/{com_um}/environments")
    c20, corpo20, contador = _contar(db, client_a, f"/api/projects/{com_vinte}/environments")

    assert len(corpo1) == 1 and len(corpo20) == 20
    assert all(a["dna"] and a["dna"]["floor_area"] == 10.0 for a in corpo20)
    assert c1 == c20, f"{c1} contra {c20}:\n  " + contador.resumo()
    # 1 contexto/entitlements + 1 obter do projeto + 1 ambientes com join do DNA.
    assert c20 <= 3, f"{c20} consultas nos ambientes:\n  " + contador.resumo()
