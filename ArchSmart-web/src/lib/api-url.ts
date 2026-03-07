/**
 * Get the API base URL based on environment
 * In production, uses NEXT_PUBLIC_API_URL
 * In development, defaults to localhost:8000
 */
export function getApiUrl(): string {
    return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim();
}

/**
 * Build a full API endpoint URL
 * @param path - API path (e.g., "/api/auth/login")
 */
export function apiUrl(path: string): string {
    const baseUrl = getApiUrl();
    // Ensure path starts with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
}
