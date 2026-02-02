"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        // Get the hash fragment and query params from the URL
        const hash = window.location.hash;
        const search = window.location.search;
        const searchParams = new URLSearchParams(search);
        const flow = searchParams.get("flow");

        const fullUrl = window.location.href;

        console.log("🔍 DEBUG CALLBACK:");
        console.log("Full URL:", fullUrl);
        console.log("Hash:", hash);
        console.log("Flow (Query):", flow);

        if (hash) {
            // Parse the hash to get the token and type
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get("access_token");
            const type = params.get("type");
            const error = params.get("error");
            const errorDescription = params.get("error_description");

            console.log("Access Token:", accessToken ? "✅ Found" : "❌ Not found");
            console.log("Type (Hash):", type);
            console.log("Error:", error);

            // Handle errors
            if (error) {
                console.error("Auth error:", error, errorDescription);
                router.push(`/auth/register?error=${encodeURIComponent(errorDescription || error)}`);
                return;
            }

            // Handle different auth types
            if (accessToken) {
                // Check explicit flow param OR hash type
                if (flow === "recovery" || type === "recovery") {
                    // Password recovery flow
                    console.log("➡️ Redirecting to /auth/reset-password");
                    router.push(`/auth/reset-password${hash}`);
                } else {
                    // Magic link signup/login flow
                    console.log("➡️ Redirecting to /auth/verify");
                    router.push(`/auth/verify${hash}`);
                }
            } else {
                // No token found, redirect to home
                console.warn("⚠️ No access token found in callback - redirecting to home");
                router.push("/");
            }
        } else {
            // No hash fragment, redirect to home
            console.warn("⚠️ No hash fragment found in callback - redirecting to home");
            router.push("/");
        }
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Processando autenticação...</p>
            </div>
        </div>
    );
}
