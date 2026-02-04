"use client";

import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api-url";

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
    account: {
        id: string;
        name: string;
        subscription_status: string;
        plan_name?: string;
    };
}

interface UseUserProfileReturn {
    user: UserProfile | null;
    isLoading: boolean;
    error: string | null;
}

export function useUserProfile(): UseUserProfileReturn {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchUserProfile() {
            try {
                // Get Supabase session to extract token
                const { createClient } = await import("@/utils/supabase/client");
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    throw new Error("No active session");
                }

                const response = await fetch(apiUrl("/api/users/me"), {
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch user profile");
                }

                const data = await response.json();
                setUser(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }

        fetchUserProfile();
    }, []);

    return { user, isLoading, error };
}
