"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Send, User, MessageSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";

interface Comment {
    id: string;
    author_type: "CLIENT" | "ARCHITECT";
    text: string;
    created_at: string;
}

interface PresentationCommentsDrawerProps {
    presentationId: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onStatusChange?: (newStatus: string) => void;
}

export function PresentationCommentsDrawer({ presentationId, isOpen, onOpenChange, onStatusChange }: PresentationCommentsDrawerProps) {
    const { toast } = useToast();
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [newText, setNewText] = useState("");

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(apiUrl(`/api/presentations/${presentationId}/comments`), {
                headers: { "Authorization": `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchComments();
        }
    }, [isOpen, presentationId]);

    const handleSend = async () => {
        if (!newText.trim()) return;
        setIsSending(true);

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(apiUrl(`/api/presentations/${presentationId}/comments`), {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: newText.trim() }),
            });

            if (res.ok) {
                const data = await res.json();
                setComments(prev => [...prev, data.comment]);
                setNewText("");
                if (data.status === "success" && onStatusChange) {
                    onStatusChange("PUBLISHED"); // Atualiza o badge do Builder
                }
                toast({ title: "Resposta enviada", description: "O cliente poderá continuar a avaliação." });
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Falha ao enviar." });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Ops!", description: "Problema de conexão." });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 z-[300]">
                <SheetHeader className="p-6 border-b border-border bg-muted flex-shrink-0">
                    <SheetTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-600" />
                        Feedback do Cliente
                    </SheetTitle>
                    <SheetDescription>
                        Acompanhe comentários e responda para devolver a apresentação ao cliente.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/30 relative">
                    {/* Linha da timeline */}
                    {comments.length > 0 && (
                        <div className="absolute left-[40px] top-6 bottom-6 w-0.5 bg-border" />
                    )}

                    {isLoading ? (
                        <p className="text-sm text-center text-muted-foreground">Carregando mensagens...</p>
                    ) : comments.length === 0 ? (
                        <div className="text-center mt-12">
                            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground font-medium">Nenhum feedback recebido ainda.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 relative">
                            {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-4">
                                    <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-4 border-background shadow-sm z-10 ${comment.author_type === "CLIENT" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                                        }`}>
                                        <User className="w-3.5 h-3.5" />
                                    </div>
                                    <div className={`flex-1 rounded-2xl p-4 shadow-sm border ${comment.author_type === "CLIENT"
                                            ? "bg-card border-emerald-100 dark:border-emerald-900/60 rounded-tl-none"
                                            : "bg-muted border-border rounded-tr-none"
                                        }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold text-xs text-foreground tracking-tight">
                                                {comment.author_type === "CLIENT" ? "Cliente" : "Você"}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                                {format(new Date(comment.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                            {comment.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-card flex-shrink-0">
                    <label className="sr-only">Sua resposta</label>
                    <textarea
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        placeholder="Digite sua resposta ou contra-proposta..."
                        className="w-full resize-none rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-3 text-sm min-h-[80px]"
                    />
                    <div className="flex justify-between items-center mt-3">
                        <p className="text-[11px] text-muted-foreground font-medium max-w-[200px]">
                            Responder alterará o status para PUBLICADO, devolvendo a tarefa ao cliente.
                        </p>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !newText.trim()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm flex items-center gap-2 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSending ? "Enviando..." : "Responder"}
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
