"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Presentation } from "@/types/presentation";
import { apiUrl } from "@/lib/api-url";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { CreatePresentationDialog } from "../../../presentations/components/CreatePresentationDialog";

interface PresentationsTabProps {
    projectId: string;
}

async function fetchProjectPresentations(projectId: string): Promise<Presentation[]> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    const response = await fetch(apiUrl(`/api/projects/${projectId}/presentations`), {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) throw new Error("Falha ao carregar apresentações");
    return response.json();
}

export function PresentationsTab({ projectId }: PresentationsTabProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Cacheado pelo React Query: ao voltar para esta aba os dados vêm do cache
    // (instantâneo) e revalidam em background.
    const { data: presentations = [], isLoading: loading } = useQuery({
        queryKey: ["project-presentations", projectId],
        queryFn: () => fetchProjectPresentations(projectId),
    });

    return (
        <div className="h-full bg-card rounded-xl shadow-sm border border-border p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Apresentações do Projeto</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Reúna ambientes 3D, referências e orçamentos para apresentar ao cliente.
                    </p>
                </div>
                <button
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors font-medium text-sm shadow-sm"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <Plus className="w-4 h-4" />
                    Nova Apresentação
                </button>
            </div>

            <CreatePresentationDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false)
                    // Revalida a lista após criar/fechar o modal.
                    queryClient.invalidateQueries({ queryKey: ["project-presentations", projectId] })
                }}
                defaultProjectId={projectId}
            />

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground mt-4">Carregando...</p>
                </div>
            ) : presentations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-xl">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Plus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma apresentação</h3>
                    <p className="text-muted-foreground max-w-[300px] text-center text-sm mb-6">
                        Você ainda não criou nenhuma apresentação para este projeto.
                    </p>
                    <button
                        className="flex items-center gap-2 bg-card border border-border hover:bg-muted text-foreground px-4 py-2 rounded-md transition-colors font-medium text-sm shadow-sm"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        Criar primeira apresentação
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {presentations.map((presentation) => (
                        <div key={presentation.id} className="group relative bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-[280px]">
                            {/* Thumbnail Placeholder / Cover Image */}
                            <div className="h-32 bg-muted w-full relative">
                                {presentation.branding_snapshot?.cover_url ? (
                                    <img
                                        src={presentation.branding_snapshot.cover_url}
                                        alt={presentation.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs text-muted-foreground font-medium">Sem imagem predefinida</span>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3">
                                    <span className={`inline-flex items-center px-2 py-1 rounded bg-background/90 backdrop-blur text-[10px] font-medium shadow-sm uppercase tracking-wider
                        ${presentation.status === 'DRAFT' ? 'text-muted-foreground' :
                                            presentation.status === 'PUBLISHED' ? 'text-blue-700 dark:text-blue-400' :
                                                presentation.status === 'ACCEPTED' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
                                        }`}>
                                        {presentation.status === 'DRAFT' ? 'Rascunho' :
                                            presentation.status === 'PUBLISHED' ? 'Publicado' :
                                                presentation.status === 'ACCEPTED' ? 'Aprovado' : 'Revisão'}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{presentation.name}</h3>
                                {presentation.description && (
                                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 flex-1">
                                        {presentation.description}
                                    </p>
                                )}

                                <div className="mt-auto pt-4 flex items-center justify-between border-t border-border">
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(presentation.created_at).toLocaleDateString("pt-BR")}
                                    </div>
                                    <button
                                        className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 group-hover:underline underline-offset-4"
                                        onClick={() => router.push(`/projects/${projectId}/presentation/${presentation.id}/builder`)}
                                    >
                                        Abrir Builder
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
