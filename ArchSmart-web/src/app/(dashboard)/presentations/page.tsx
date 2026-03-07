"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Presentation } from "@/types/presentation";
import { apiUrl } from "@/lib/api-url";
import { createClient } from "@/utils/supabase/client";
import { CreatePresentationDialog } from "./components/CreatePresentationDialog";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function PresentationsPage() {
    const router = useRouter();
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [presentationToDelete, setPresentationToDelete] = useState<string | null>(null);

    useEffect(() => {
        async function loadPresentations() {
            try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token || "";

                const response = await fetch(apiUrl("/api/presentations"), {
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
    }, [isDialogOpen]);

    const handleDelete = async (presentationId: string) => {
        setPresentationToDelete(presentationId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!presentationToDelete) return;
        const idToDelete = presentationToDelete;
        setIsDeleteDialogOpen(false);
        setPresentationToDelete(null);

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || "";

            const response = await fetch(apiUrl(`/api/presentations/${idToDelete}`), {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                setPresentations(prev => prev.filter(p => p.id !== idToDelete));
                toast.success("Apresentação excluída com sucesso");
            } else {
                toast.error("Erro ao excluir apresentação");
            }
        } catch (err) {
            console.error("Error deleting presentation:", err);
            toast.error("Falha na rede ao excluir apresentação");
        }
    };

    return (
        <div className="p-8 h-full bg-[#FAFAFA]">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Apresentações</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gerencie todas as apresentações dos seus projetos.
                    </p>
                </div>
                <button
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg transition-colors font-medium text-sm shadow-sm"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <Plus className="w-4 h-4" />
                    Nova Apresentação
                </button>
            </div>

            <CreatePresentationDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Tem certeza que deseja excluir apresentação?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPresentationToDelete(null)}>Cancelar</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir Apresentação
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {loading ? (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-4">Carregando apresentações...</p>
                </div>
            ) : presentations.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Plus className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Nenhuma apresentação
                    </h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-6 text-sm">
                        Você ainda não criou nenhuma apresentação. Crie uma para poder visualizar o modelo 3D e compartilhar com seus clientes.
                    </p>
                    <button
                        className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        Começar
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <th className="py-4 px-6">Nome da Apresentação</th>
                                <th className="py-4 px-6">Projeto</th>
                                <th className="py-4 px-6">Status</th>
                                <th className="py-4 px-6">Data</th>
                                <th className="py-4 px-6 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {presentations.map((presentation) => (
                                <tr key={presentation.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="font-medium text-gray-900">{presentation.name}</div>
                                        {presentation.description && (
                                            <div className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{presentation.description}</div>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                                            {presentation.project?.name || "Desconhecido"}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium 
                        ${presentation.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                                                presentation.status === 'PUBLISHED' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10' :
                                                    presentation.status === 'ACCEPTED' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                                        'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                                            }`}>
                                            {presentation.status === 'DRAFT' ? 'Rascunho' :
                                                presentation.status === 'PUBLISHED' ? 'Publicado' :
                                                    presentation.status === 'ACCEPTED' ? 'Aprovado' : 'Revisão'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-gray-500 text-sm">
                                        {new Date(presentation.created_at).toLocaleDateString("pt-BR")}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button
                                                className="text-sm text-primary hover:text-primary/80 font-medium underline-offset-4 hover:underline"
                                                onClick={() => router.push(`/projects/${presentation.project_id}/presentation/${presentation.id}/builder`)}
                                            >
                                                Abrir Builder
                                            </button>
                                            <button
                                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                onClick={() => handleDelete(presentation.id)}
                                                title="Excluir apresentação"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
