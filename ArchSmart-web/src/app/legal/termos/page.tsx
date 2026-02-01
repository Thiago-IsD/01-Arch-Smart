import Link from "next/link";
import Footer from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

export default function TermsPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto px-4 py-8 flex-1 pt-24">
                <h1 className="text-3xl font-bold mb-4">Termos de Uso</h1>
                <div className="prose dark:prose-invert max-w-none">
                    <p>Em construção...</p>
                    <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                    </p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
