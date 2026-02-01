'use client';

import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
    Rocket,
    Gift,
    Megaphone,
    Zap,
    CheckCircle2,
    Clock,
    Hammer,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Components ---

const BenefitCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="flex flex-col items-center text-center p-6 rounded-2xl border bg-card hover:shadow-lg transition-all duration-300 group">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
            <Icon size={24} />
        </div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
    </div>
);



export default function BetaPage() {
    // Custom color for conversion elements
    const coralColor = "bg-[#F88379] hover:bg-[#F88379]/90 text-white border-transparent";

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />

            <main className="flex-1">
                {/* 1. Hero Section: Tech/Dark Theme */}
                <section className="relative py-24 lg:py-32 overflow-hidden bg-slate-900 text-white selection:bg-[#F88379] selection:text-white">
                    {/* Background Gradients */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#F88379]/10 rounded-full blur-[120px] -z-10 opacity-40 pointer-events-none" />

                    <div className="container px-4 md:px-6 relative z-10 text-center flex flex-col items-center">
                        <Badge className={cn("mb-6 px-4 py-1.5 text-sm font-semibold rounded-full shadow-lg shadow-[#F88379]/20 animate-in fade-in slide-in-from-bottom-4 duration-700", coralColor)}>
                            🚀 Acesso Antecipado: Vagas Limitadas
                        </Badge>

                        <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
                            Ajude a construir a ferramenta que você <span className="text-[#F88379]">sempre quis usar.</span>
                        </h1>

                        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                            Seja um dos primeiros escritórios a testar o Arch Smart. Tenha acesso gratuito durante o período de validação e influencie diretamente nosso roadmap.
                        </p>

                        <div className="flex flex-col items-center gap-4 w-full">
                            <Button size="lg" className={cn("h-14 px-8 text-lg font-bold rounded-full shadow-xl shadow-[#F88379]/20 w-full sm:w-auto", coralColor)} asChild>
                                <Link href="/beta/register">
                                    Solicitar Convite Beta
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                            <p className="text-sm text-slate-400 font-medium">
                                ⭐ Junte-se a outros 50+ arquitetos inovadores
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Benefits Grid */}
                <section className="py-24 bg-background">
                    <div className="container px-4 md:px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tight mb-4">Vantagens de quem chega primeiro</h2>
                            <p className="text-muted-foreground max-w-2xl mx-auto">
                                Participar do Beta não é apenas testar software. É garantir benefícios exclusivos para o futuro do seu escritório.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                            <BenefitCard
                                icon={Gift}
                                title="Condição Especial de Fundador"
                                description="Validadores ativos garantem meses gratuitos ou descontos vitalícios no lançamento oficial."
                            />
                            <BenefitCard
                                icon={Megaphone}
                                title="Influencie o Roadmap"
                                description="Canal direto com os fundadores. Sugira features e vote no que devemos construir a seguir."
                            />
                            <BenefitCard
                                icon={Zap}
                                title="Vantagem Competitiva"
                                description="Domine a ferramenta que vai padronizar o mercado antes dos seus concorrentes."
                            />
                        </div>
                    </div>
                </section>



                {/* 4. Ideal Profile Checklist */}
                <section className="py-24 bg-background">
                    <div className="container px-4 md:px-6 max-w-3xl mx-auto">
                        <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                            {/* Decorative Blob */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#F88379]/10 rounded-full blur-3xl rounded-bl-full pointer-events-none" />

                            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center md:text-left">
                                Este Beta é para você se...
                            </h2>

                            <div className="space-y-6">
                                {[
                                    "Você gasta horas passando limpo especificações do WhatsApp para o Excel.",
                                    "Seu escritório está crescendo e a gestão atual não dá mais conta.",
                                    "Você gosta de testar novas tecnologias e dar feedbacks construtivos."
                                ].map((item, index) => (
                                    <div key={index} className="flex items-start gap-4">
                                        <div className="h-6 w-6 rounded-full bg-[#F88379] flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 size={14} className="text-white" />
                                        </div>
                                        <p className="text-lg text-slate-200 leading-relaxed font-medium">
                                            {item}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. Footer Urgency CTA */}
                <section className="py-24 bg-muted/30">
                    <div className="container px-4 text-center">
                        <div className="max-w-2xl mx-auto space-y-8">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                                As vagas para este ciclo são limitadas.
                            </h2>
                            <p className="text-lg text-muted-foreground">
                                Não perca a chance de moldar o futuro da sua ferramenta de trabalho.
                            </p>
                            <div className="flex justify-center pt-4">
                                <Button size="lg" className={cn("h-14 px-10 text-lg gap-2 shadow-xl", coralColor)} asChild>
                                    <Link href="/beta/register">
                                        Garantir minha vaga agora
                                    </Link>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">
                                *Acesso sujeito a aprovação. Prioridade para e-mails corporativos.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
