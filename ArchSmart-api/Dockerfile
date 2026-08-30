FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# A migracao roda aqui, no start do container, e nao num Pre-Deploy Command:
# esse campo do Render e recurso de instancia paga, e os dois servicos rodam no
# free tier. O `&&` e deliberado — migracao vermelha derruba o deploy em vez de
# subir a API contra um schema desatualizado. Ver docs/dev/decisoes/0007.
# Guardado por ArchSmart-api/tests/test_migracao_no_start.py.
CMD ["sh", "-c", "alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
