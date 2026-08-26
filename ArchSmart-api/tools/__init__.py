"""
Scripts que falam com o banco da aplicacao.

Existe um segundo `tools/`, na raiz do repositorio, com scripts que checam o
proprio processo (progresso.py, checa_links.py) e nunca tocam o banco — ver
docs/README.md. Sao dois diretorios com o mesmo nome e regras diferentes.

Este arquivo torna o diretorio um pacote para que `tools.guarda_banco` possa
ser importado tanto pelos scripts daqui quanto por tests/conftest.py, em vez de
cada um remendar o sys.path por conta propria.
"""
