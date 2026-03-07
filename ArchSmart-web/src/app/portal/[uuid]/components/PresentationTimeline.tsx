"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, User } from "lucide-react";

interface Comment {
    id: string;
    author_type: "CLIENT" | "ARCHITECT";
    text: string;
    created_at: string;
}

interface TimelineProps {
    presentationId: string;
}

export function PresentationTimeline({ presentationId }: TimelineProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchComments = async () => {
            try {
                const url = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim();
                const res = await fetch(`${url}/public/presentations/${presentationId}/comments`);
                if (res.ok) {
                    const data = await res.json();
                    setComments(data);
                }
            } catch (error) {
                console.error("Erro ao puxar feedback:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchComments();
    }, [presentationId]);

    if (isLoading) return null;
    if (comments.length === 0) return null;

    return (
        <div className="mt-12 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-800">Histórico de Avaliações</h3>
            </div>
            <div className="p-6 relative">
                {/* Linha vertical da Timeline */}
                <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-slate-100" />

                <div className="space-y-6 relative">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-4">
                            <div className={`mt-1 shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10 ${comment.author_type === "ARCHITECT" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"
                                }`}>
                                <User className="w-4 h-4" />
                            </div>
                            <div className="flex-1 bg-slate-50 border border-slate-200/60 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-sm text-slate-800">
                                        {comment.author_type === "ARCHITECT" ? "Arquiteto" : "Você"}
                                    </span>
                                    <span className="text-xs font-medium text-slate-400">
                                        {format(new Date(comment.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {comment.text}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
