import logging
import sys
from logging.config import dictConfig

LOG_CONFIG = {
    "version": 1,
    # Os loggers do uvicorn já existem quando isto roda; desabilitá-los deixaria o
    # servidor mudo em produção.
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)-8s %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": sys.stdout,
        },
    },
    # Nível no root para que os logger.getLogger(__name__) dos módulos herdem o handler.
    "root": {"handlers": ["console"], "level": "INFO"},
}


def setup_logging() -> None:
    """
    Configura o logging da aplicação.

    Sem isto, os logger.warning/error dos services dependiam da config default do
    uvicorn e saíam sem timestamp nem nome do módulo, o que dificultou diagnosticar
    falhas em produção pelo painel do Render.
    """
    dictConfig(LOG_CONFIG)
    logging.getLogger(__name__).debug("Logging configured")
