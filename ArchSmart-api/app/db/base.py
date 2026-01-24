from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base() # 2.0 style: from sqlalchemy.orm import DeclarativeBase; class Base(DeclarativeBase): pass
