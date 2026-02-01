'use client';

import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    FileSpreadsheet,
    MessageCircle,
    Folder,
    AlertTriangle,
    ArrowRight,
    Layers,
    Link2,
    TrendingUp,
    Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Components ---

const TechnicalGridBackground = () => (
    <div className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.03] z-0"
        style={{
            backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
        }}
    />
);

const SectionHeading = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <h2 className={cn("text-3xl md:text-4xl font-bold tracking-tight text-foreground", className)}>
        {children}
    </h2>
);

const AbstractChaos = () => (
    <div className="relative h-64 w-full bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center">
        {/* Floating "Chaos" Icons */}
        <div className="absolute top-1/4 left-1/4 p-3 bg-green-100 text-green-700 rounded-lg shadow-sm rotate-[-12deg]">
            <FileSpreadsheet size={24} />
        </div>
        <div className="absolute bottom-1/3 right-1/4 p-3 bg-blue-100 text-blue-700 rounded-lg shadow-sm rotate-[15deg]">
            <MessageCircle size={24} />
        </div>
        <div className="absolute top-1/3 right-1/3 p-3 bg-yellow-100 text-yellow-700 rounded-lg shadow-sm rotate-[6deg]">
            <Folder size={24} />
        </div>
        <div className="absolute bottom-1/4 left-1/3 p-2 bg-red-100 text-red-700 rounded-full shadow-md z-10 animate-pulse">
            <AlertTriangle size={20} />
        </div>

        {/* Connection Lines (Simulating mess) */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none stroke-slate-400" strokeWidth="1">
            <path d="M100,100 Q200,50 300,150" fill="none" />
            <path d="M50,200 Q150,250 250,180" fill="none" />
            <path d="M300,50 Q250,150 150,100" fill="none" />
        </svg>

        <div className="absolute bottom-4 text-xs font-mono text-muted-foreground bg-white/50 backdrop-blur px-2 py-1 rounded">
            System Error: Workflow_Disconnected
        </div>
    </div>
);

const VisionPillar = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="flex flex-col gap-4 p-8 border-l-2 border-primary/20 hover:border-primary transition-colors bg-gradient-to-br from-background to-muted/20">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Icon size={24} />
        </div>
        <div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
    </div>
);

export default function SobrePage() {
    return (
        <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-primary/20">
            <Navbar />

            <main className="flex-1 relative">

                {/* 1. Hero Section (Manifesto) */}
                <section className="relative py-32 lg:py-48 flex items-center justify-center text-center px-4 overflow-hidden">
                    <TechnicalGridBackground />
                    <div className="container max-w-5xl mx-auto relative z-10 space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-background/50 backdrop-blur text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
                            Manifesto Arch Smart
                        </div>
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter text-foreground leading-[1.1]">
                            Arquitetura é arte e técnica.<br />
                            <span className="text-primary">Não burocracia.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-light leading-relaxed">
                            Nascemos porque acreditamos que sua criatividade não deveria ser refém de planilhas financeiras desconexas.
                        </p>
                    </div>
                </section>

                <div className="container px-4"><div className="h-px w-full bg-border" /></div>

                {/* 2. The Problem */}
                <section className="py-32">
                    <div className="container px-4 md:px-6">
                        <div className="grid md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
                            <div className="space-y-8">
                                <SectionHeading>
                                    O caos operacional mata o <span className="text-primary italic">bom design</span>.
                                </SectionHeading>
                                <div className="space-y-6 text-lg text-muted-foreground">
                                    <p>
                                        <strong className="text-foreground">O Cenário Atual:</strong> Hoje, um escritório usa 5 ferramentas para entregar um projeto: Planilha para orçamento, Trello para tarefas, WhatsApp para validação, Drive para arquivos...
                                    </p>
                                    <p>
                                        <strong className="text-foreground">A Consequência:</strong> O resultado? Erros de cálculo, retrabalho e menos tempo projetando.
                                    </p>
                                </div>
                            </div>

                            {/* Visual Abstract Chaos */}
                            <div className="relative">
                                <div className="absolute -inset-4 bg-muted/50 rounded-3xl -z-10 rotate-3" />
                                <AbstractChaos />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. The Vision (The System) */}
                <section className="py-32 bg-slate-50 dark:bg-slate-900/50">
                    <div className="container px-4 md:px-6">
                        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                                Não somos um app. <br />
                                <span className="text-primary">Somos um Sistema.</span>
                            </h2>
                            <p className="text-lg text-muted-foreground">
                                Uma plataforma unificada onde o dado flui, não se perde.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                            <VisionPillar
                                icon={Layers}
                                title="DNA Técnico"
                                description="Tudo nasce do projeto. O orçamento não é um chute, é um cálculo baseado na metragem real e nas especificações técnicas."
                            />
                            <VisionPillar
                                icon={Link2}
                                title="Conexão"
                                description="O que você especifica na biblioteca vira custo no orçamento e item visual na apresentação. Sem redigitar. Sem perda de informação."
                            />
                            <VisionPillar
                                icon={TrendingUp}
                                title="Previsibilidade"
                                description="Saiba quanto vai custar e quando vai receber antes mesmo de começar. Transforme a incerteza da obra em dados confiáveis."
                            />
                        </div>
                    </div>
                </section>

                {/* 4. The Future */}
                <section className="py-32 relative overflow-hidden">
                    <div className="container px-4 md:px-6 text-center relative z-10">
                        <div className="max-w-4xl mx-auto space-y-8">
                            <Cpu size={48} className="mx-auto text-primary/50 mb-8" />
                            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
                                Construindo o padrão da indústria.
                            </h2>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                Estamos criando a primeira plataforma que une a visão criativa com a inteligência de dados e IA.
                                O Arch Smart é a fundação para escritórios que querem escalar, não apenas sobreviver.
                            </p>
                        </div>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute bottom-0 left-0 w-full h-[500px] bg-gradient-to-t from-muted/50 to-transparent -z-10" />
                </section>

                {/* 5. Footer CTA */}
                <section className="py-16 border-t">
                    <div className="container px-4 text-center">
                        <Link href="/beta" className="group inline-flex items-center gap-2 text-primary font-bold hover:opacity-80 transition-opacity">
                            Faça parte da mudança
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </section>

            </main>
            <Footer />
        </div>
    );
}
