"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Presentation } from "@/types/presentation";
import { apiUrl } from "@/lib/api-url";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { CreatePresentationDialog } from "../../../presentations/components/CreatePresentationDialog";

interface PresentationsTabProps {
    projectId: string;
}

export function PresentationsTab({ projectId }: PresentationsTabProps) {
    const router = useRouter();
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        async function loadPresentations() {
            try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token || "";

                const response = await fetch(apiUrl(`/api/projects/${projectId}/presentations`), {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setPresentations(data);
                }
            } catch (error) {
                console.error("Erro ao carregar apresentações:", error);
            } finally {
                setLoading(false);
            }
        }
        loadPresentations();
    }, [projectId, isDialogOpen]);

    return (
        <div className="h-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Apresentações do Projeto</h2>
                    <p className="text-sm text-gray-500 mt-1">
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
                onClose={() => setIsDialogOpen(false)}
                defaultProjectId={projectId}
            />

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-gray-500 mt-4">Carregando...</p>
                </div>
            ) : presentations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-100 rounded-xl">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Plus className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma apresentação</h3>
                    <p className="text-gray-500 max-w-[300px] text-center text-sm mb-6">
                        Você ainda não criou nenhuma apresentação para este projeto.
                    </p>
                    <button
                        className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md transition-colors font-medium text-sm shadow-sm"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        Criar primeira apresentação
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {presentations.map((presentation) => (
                        <div key={presentation.id} className="group relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-[280px]">
                            {/* Thumbnail Placeholder / Cover Image */}
                            <div className="h-32 bg-gray-100 w-full relative">
                                {presentation.branding_snapshot?.cover_url ? (
                                    <img
                                        src={presentation.branding_snapshot.cover_url}
                                        alt={presentation.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs text-gray-400 font-medium">Sem imagem predefinida</span>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3">
                                    <span className={`inline-flex items-center px-2 py-1 rounded bg-white/90 backdrop-blur text-[10px] font-medium shadow-sm uppercase tracking-wider
                        ${presentation.status === 'DRAFT' ? 'text-gray-600' :
                                            presentation.status === 'PUBLISHED' ? 'text-blue-700' :
                                                presentation.status === 'ACCEPTED' ? 'text-green-700' : 'text-amber-700'
                                        }`}>
                                        {presentation.status === 'DRAFT' ? 'Rascunho' :
                                            presentation.status === 'PUBLISHED' ? 'Publicado' :
                                                presentation.status === 'ACCEPTED' ? 'Aprovado' : 'Revisão'}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-semibold text-gray-900 group-hover:text-[#F36224] transition-colors">{presentation.name}</h3>
                                {presentation.description && (
                                    <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 flex-1">
                                        {presentation.description}
                                    </p>
                                )}

                                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                                    <div className="text-xs text-gray-400">
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
