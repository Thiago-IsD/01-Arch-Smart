export type PresentationStatus = 'DRAFT' | 'PUBLISHED' | 'ACCEPTED' | 'REVISION_REQUESTED';

export interface Project {
    id: string;
    name: string;
}

export interface Environment {
    id: string;
    name: string;
}

export interface PresentationEnvironment {
    id: string;
    presentation_id: string;
    environment_id: string;
    is_visible: boolean;
    environment?: Environment;
}

export interface Presentation {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    status: PresentationStatus;
    branding_snapshot?: any;
    created_at: string;
    environments: PresentationEnvironment[];
    project?: Project;
}
