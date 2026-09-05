from fastapi import APIRouter, Depends, status
from uuid import UUID
from typing import List

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Environment, EnvironmentDNA, Project
from app.schemas.environment_schema import EnvironmentCreate, EnvironmentResponse, EnvironmentDNAUpdate, EnvironmentDNAResponse

router = APIRouter()

@router.post("/projects/{project_id}/environments", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
def create_environment(
    project_id: UUID,
    data: EnvironmentCreate,
    repo: ScopedRepository = Depends(get_repo),
):
    # Verify if project exists and user has access (simplified for MVP: user -> account -> project)
    project = repo.obter(Project, project_id)

    # Create Environment
    new_env = repo.create(
        Environment,
        project_id=project_id,
        name=data.name,
        type=data.type,
    )
    repo.db.flush() # flush to get the new_env.id before committing

    # DNA: usa os valores enviados no cadastro (opcionais) ou inicia zerado.
    floor = data.dna.floor_area if data.dna else 0.0
    wall = data.dna.wall_area if data.dna else 0.0
    ceiling = data.dna.ceiling_area if data.dna else 0.0

    repo.create(
        EnvironmentDNA,
        environment_id=new_env.id,
        floor_area=floor,
        wall_area=wall,
        ceiling_area=ceiling,
        is_complete=(floor > 0 and wall > 0 and ceiling > 0),
    )
    repo.db.commit()
    repo.db.refresh(new_env)

    return new_env

@router.get("/projects/{project_id}/environments", response_model=List[EnvironmentResponse])
def get_environments(
    project_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    repo.obter(Project, project_id)

    environments = repo.query(Environment).filter(Environment.project_id == project_id).all()
    return environments

@router.put("/environments/{env_id}/dna", response_model=EnvironmentDNAResponse)
def update_environment_dna(
    env_id: UUID,
    data: EnvironmentDNAUpdate,
    repo: ScopedRepository = Depends(get_repo),
):
    # Retrieve environment with access check
    env = repo.obter(Environment, env_id)

    dna = repo.query(EnvironmentDNA).filter(EnvironmentDNA.environment_id == env_id).first()
    if not dna:
        # Should never happen if creation logic was followed, but safe fallback
        dna = repo.create(EnvironmentDNA, environment_id=env_id)

    # Update areas
    dna.floor_area = data.floor_area
    dna.wall_area = data.wall_area
    dna.ceiling_area = data.ceiling_area

    # Business Logic: Completeness Flag
    if dna.floor_area > 0 and dna.wall_area > 0 and dna.ceiling_area > 0:
        dna.is_complete = True
    else:
        dna.is_complete = False

    repo.db.commit()
    repo.db.refresh(dna)
    return dna

@router.delete("/environments/{env_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(
    env_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    env = repo.obter(Environment, env_id)

    repo.remover(env) # Also deletes EnvironmentDNA due to cascade="all, delete-orphan" inside all_models.py
    repo.db.commit()
    return None
