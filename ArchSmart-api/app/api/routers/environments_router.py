from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.db.session import get_db
from app.models.all_models import Environment, EnvironmentDNA, Project, User
from app.schemas.environment_schema import EnvironmentCreate, EnvironmentResponse, EnvironmentDNAUpdate, EnvironmentDNAResponse
from app.api.users import get_current_user

router = APIRouter()

@router.post("/projects/{project_id}/environments", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
def create_environment(
    project_id: UUID, 
    data: EnvironmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify if project exists and user has access (simplified for MVP: user -> account -> project)
    project = db.query(Project).filter(Project.id == project_id, Project.account_id == current_user.account_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create Environment
    new_env = Environment(
        project_id=project_id,
        name=data.name,
        type=data.type
    )
    db.add(new_env)
    db.flush() # flush to get the new_env.id before committing

    # Automatically create the empty DNA record
    new_dna = EnvironmentDNA(
        environment_id=new_env.id,
        floor_area=0.0,
        wall_area=0.0,
        ceiling_area=0.0,
        is_complete=False
    )
    db.add(new_dna)
    db.commit()
    db.refresh(new_env)

    return new_env

@router.get("/projects/{project_id}/environments", response_model=List[EnvironmentResponse])
def get_environments(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.account_id == current_user.account_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    environments = db.query(Environment).filter(Environment.project_id == project_id).all()
    return environments

@router.put("/environments/{env_id}/dna", response_model=EnvironmentDNAResponse)
def update_environment_dna(
    env_id: UUID,
    data: EnvironmentDNAUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve environment with access check
    env = db.query(Environment).join(Project).filter(
        Environment.id == env_id,
        Project.account_id == current_user.account_id
    ).first()
    
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")

    dna = db.query(EnvironmentDNA).filter(EnvironmentDNA.environment_id == env_id).first()
    if not dna:
        # Should never happen if creation logic was followed, but safe fallback
        dna = EnvironmentDNA(environment_id=env_id)
        db.add(dna)

    # Update areas
    dna.floor_area = data.floor_area
    dna.wall_area = data.wall_area
    dna.ceiling_area = data.ceiling_area

    # Business Logic: Completeness Flag
    if dna.floor_area > 0 and dna.wall_area > 0 and dna.ceiling_area > 0:
        dna.is_complete = True
    else:
        dna.is_complete = False

    db.commit()
    db.refresh(dna)
    return dna

@router.delete("/environments/{env_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(
    env_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    env = db.query(Environment).join(Project).filter(
        Environment.id == env_id,
        Project.account_id == current_user.account_id
    ).first()
    
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")

    db.delete(env) # Also deletes EnvironmentDNA due to cascade="all, delete-orphan" inside all_models.py
    db.commit()
    return None
