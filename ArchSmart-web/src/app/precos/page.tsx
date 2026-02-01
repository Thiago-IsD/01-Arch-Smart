'use client';

import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Check,
    X,
    Plus,
    HelpCircle,
    Building2,
    User,
    Zap,
    LayoutGrid,
    Database,
    MessageSquare,
    Chrome,
    ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

// --- Components ---

const AbstractSlots = () => (
    <div className="w-full max-w-3xl mx-auto bg-muted/20 rounded-xl p-8 border border-dashed border-primary/20">
        <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 flex-wrap justify-center">
                {/* Active Project Slot */}
                <div className="relative group perspective-1000">
                    <div className="w-32 h-24 bg-background border-2 border-primary rounded-lg shadow-lg flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1">
                        <Building2 className="text-primary h-6 w-6" />
                        <span className="text-xs font-bold">Res. Silva</span>
                        <Badge variant="secondary" className="text-[10px] h-4">Ativo</Badge>
                    </div>
                </div>

                {/* Active Project Slot */}
                <div className="relative group">
                    <div className="w-32 h-24 bg-background border-2 border-primary rounded-lg shadow-lg flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1">
                        <Building2 className="text-primary h-6 w-6" />
                        <span className="text-xs font-bold">Comercial JK</span>
                        <Badge variant="secondary" className="text-[10px] h-4">Ativo</Badge>
                    </div>
                </div>

                {/* Add Slot */}
                <div className="relative group cursor-pointer">
                    <div className="w-32 h-24 bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-colors">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Plus className="text-primary h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium text-primary">Adicionar Slot</span>
                    </div>
                </div>
            </div>

            <div className="text-center space-y-2 max-w-lg">
                <p className="font-medium text-base">Entenda o Pay-per-project</p>
                <p className="text-sm text-muted-foreground">
                    Você paga apenas pelos slots ativos. Arquivou o projeto? O slot libera na hora para um novo cliente.
                    <br /><span className="text-primary font-medium">Projetos arquivados não ocupam espaço.</span>
                </p>
            </div>
        </div>
    </div>
);

export default function PricingPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
            <Navbar />

            <main className="flex-1">
                {/* 1. Hero Section */}
                <section className="py-20 lg:py-24 text-center px-4">
                    <div className="container max-w-4xl mx-auto space-y-6">
                        <Badge variant="outline" className="py-1.5 px-4 bg-primary/5 border-primary/20 text-primary mb-4">
                            Modelo Flexível
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                            Cresça no seu ritmo. <br className="hidden md:block" />
                            <span className="text-primary">Pague pelo que usar.</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Sem mensalidades abusivas. Comece com o essencial e adicione projetos extras apenas quando fechar novos contratos.
                        </p>
                    </div>
                </section>

                {/* 2. Abstract UI: Slots Explanation */}
                <section className="pb-24 px-4">
                    <AbstractSlots />
                </section>

                <div className="container px-4"><div className="h-px bg-border" /></div>

                {/* 3. Pricing Cards */}
                <section className="py-24 bg-muted/10">
                    <div className="container px-4 md:px-6">
                        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">

                            {/* Card 1: Solo */}
                            <div className="rounded-2xl border bg-card p-8 shadow-sm hover:shadow-md transition-shadow">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-xl flex items-center gap-2">
                                        <User size={20} className="text-muted-foreground" />
                                        Solo
                                    </h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold">R$ 119</span>
                                        <span className="text-muted-foreground">/mês</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">Ideal para arquitetos autônomos iniciando a jornada digital.</p>
                                </div>
                                <div className="mt-8 space-y-4">
                                    <Button variant="outline" className="w-full">Começar Agora</Button>
                                    <div className="space-y-3 pt-4">
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Até 2 Projetos Ativos</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Biblioteca de Produtos</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Portal do Cliente Básico</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-primary font-medium">
                                            <Plus className="h-4 w-4 shrink-0" />
                                            <span>Compre slots extras a qualquer momento</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Professional (Highlighted) */}
                            <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-xl scale-105 z-10">
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold shadow-md">
                                    Mais Popular
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-xl flex items-center gap-2 text-primary">
                                        <Zap size={20} />
                                        Professional
                                    </h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold">R$ 299</span>
                                        <span className="text-muted-foreground">/mês</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">A máquina de vendas para escritórios em expansão.</p>
                                </div>
                                <div className="mt-8 space-y-4">
                                    <Button className="w-full bg-primary hover:bg-primary/90 text-lg h-12">Teste Grátis por 7 dias</Button>
                                    <div className="space-y-3 pt-4">
                                        <div className="flex items-center gap-3 text-sm font-medium">
                                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <Check size={12} />
                                            </div>
                                            <span>Projetos Ilimitados (Sem slots)</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Shopping Hub (Curadoria IA)</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>IA Ilimitada (Chat Técnico)</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Agenda Integrada</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Studio */}
                            <div className="rounded-2xl border bg-card p-8 shadow-sm hover:shadow-md transition-shadow">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-xl flex items-center gap-2">
                                        <Building2 size={20} className="text-muted-foreground" />
                                        Studio
                                    </h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-bold">Sob Consulta</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">Para grandes equipes com múltiplas licenças Professional.</p>
                                </div>
                                <div className="mt-8 space-y-4">
                                    <Button variant="outline" className="w-full">Falar com Consultor</Button>
                                    <div className="space-y-3 pt-4">
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Tudo do plano Professional</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Condições especiais do plano Professional</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                            <span>Treinamento Onboarding</span>
                                        </div>

                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* 4. Comparison Table */}
                <section className="py-24">
                    <div className="container px-4 md:px-6 max-w-4xl mx-auto">
                        <h2 className="text-2xl font-bold text-center mb-12">Comparativo de Recursos</h2>
                        <div className="border rounded-lg overflow-hidden">
                            {/* Header */}
                            <div className="grid grid-cols-4 bg-muted/50 p-4 font-semibold text-sm">
                                <div className="col-span-2 md:col-span-1">Recursos</div>
                                <div className="text-center">Solo</div>
                                <div className="text-center text-primary">Professional</div>
                                <div className="text-center">Studio</div>
                            </div>

                            {/* Rows */}
                            {[
                                { name: "Projetos Ativos", solo: "2 Slots", pro: "Ilimitado", studio: "Ilimitado" },

                                { name: "Web Clipper", solo: true, pro: true, studio: true },
                                { name: "Biblioteca Pessoal", solo: true, pro: true, studio: true },
                                { name: "Shopping Hub (Curadoria)", solo: false, pro: true, studio: true },
                                { name: "Chat Técnico (IA)", solo: false, pro: true, studio: true },
                                { name: "Orçamentos Automáticos", solo: "Limitado", pro: "Completo", studio: "Completo" },
                            ].map((row, i) => (
                                <div key={i} className="grid grid-cols-4 p-4 border-t text-sm items-center hover:bg-muted/10">
                                    <div className="col-span-2 md:col-span-1 font-medium">{row.name}</div>
                                    <div className="text-center text-muted-foreground">
                                        {row.solo === true ? <Check className="mx-auto h-4 w-4 text-green-500" /> : row.solo === false ? <span className="text-muted-foreground">-</span> : row.solo}
                                    </div>
                                    <div className="text-center font-medium bg-primary/5 -my-4 py-4">
                                        {row.pro === true ? <Check className="mx-auto h-4 w-4 text-primary" /> : row.pro === false ? <span className="text-muted-foreground">-</span> : row.pro}
                                    </div>
                                    <div className="text-center text-muted-foreground">
                                        {row.studio === true ? <Check className="mx-auto h-4 w-4 text-green-500" /> : row.studio === false ? <span className="text-muted-foreground">-</span> : row.studio}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. FAQ Accordion */}
                <section className="py-24 bg-muted/20">
                    <div className="container px-4 md:px-6 max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold text-center mb-12">Perguntas Frequentes</h2>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>O que acontece se eu arquivar um projeto?</AccordionTrigger>
                                <AccordionContent>
                                    Ao arquivar um projeto, o slot que ele ocupava é liberado instantaneamente. Você pode então criar um novo projeto nesse slot sem custo adicional. Os dados do projeto arquivado permanecem salvos e seguros.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger>O slot extra é uma mensalidade?</AccordionTrigger>
                                <AccordionContent>
                                    Sim. Se você precisar de mais slots além dos 2 inclusos no plano Solo (por exemplo, está com 3 obras simultâneas), você pode contratar um Slot Extra. Ele funciona como um "add-on" mensal recorrente enquanto estiver ativo.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3">
                                <AccordionTrigger>Posso testar antes de assinar?</AccordionTrigger>
                                <AccordionContent>
                                    Com certeza! Você pode começar instalando o nosso Web Clipper gratuitamente e usando a versão de demonstração. O plano Professional também oferece 7 dias de garantia incondicional.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-4">
                                <AccordionTrigger>A IA substitui o meu trabalho?</AccordionTrigger>
                                <AccordionContent>
                                    Nunca. A IA do Arch Smart atua como um assistente júnior super eficiente, cuidando das tarefas repetitivas (levantamento, orçamento, especificações) para que você foque no conceito e no design.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </section>

                {/* 6. Footer CTA */}
                <section className="py-24">
                    <div className="container px-4 text-center">
                        <div className="max-w-2xl mx-auto space-y-8">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ainda na dúvida?</h2>
                            <p className="text-lg text-muted-foreground">
                                Comece organizando sua biblioteca sem pagar nada.
                            </p>
                            <div className="flex justify-center">
                                <Button size="lg" variant="outline" className="h-12 px-8 text-base gap-2" asChild>
                                    <a href="/web-clipper">
                                        <Chrome className="h-5 w-5" />
                                        Baixar Web Clipper Grátis
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
