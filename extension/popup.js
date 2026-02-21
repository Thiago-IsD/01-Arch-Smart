const URL_WEB = "http://localhost:3000";
const URL_API = "http://127.0.0.1:8000/api/clipper/capture";

let authToken = null;
let currentProduct = null;

document.addEventListener("DOMContentLoaded", async () => {
    // Button listeners
    document.getElementById("btn-login").addEventListener("click", () => {
        chrome.tabs.create({ url: `${URL_WEB}/auth/login` });
    });
    document.getElementById("btn-close").addEventListener("click", () => {
        window.close();
    });
    document.getElementById("btn-capture").addEventListener("click", captureProduct);

    // Initial Check
    await checkAuth();
});

async function checkAuth() {
    showState("loading");
    try {
        // Query cookies for localhost:3000
        const cookies = await new Promise((resolve) => {
            chrome.cookies.getAll({ url: URL_WEB }, resolve);
        });

        // Supabase SSR cookies usually have "auth-token" in their name
        const authCookies = cookies.filter(c => c.name.includes("-auth-token"));

        let token = null;
        if (authCookies.length > 0) {
            // Sort to handle chunked cookies (.0, .1)
            authCookies.sort((a, b) => a.name.localeCompare(b.name));
            const rawJsonStr = authCookies.map(c => c.value).join("");
            const decodedStr = decodeURIComponent(rawJsonStr);

            try {
                // Determine format
                let sessionData;
                if (decodedStr.startsWith("base64-")) {
                    // Next.js @supabase/ssr base64url encoding
                    let base64 = decodedStr.replace("base64-", "");
                    // convert base64url to base64
                    base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
                    const decodedBase64 = atob(base64);
                    sessionData = JSON.parse(decodedBase64);
                } else {
                    sessionData = JSON.parse(decodedStr);
                }

                if (sessionData && sessionData.access_token) {
                    token = sessionData.access_token;
                }
            } catch (e) {
                console.warn("Could not parse supabase cookie payload", e);
            }
        }

        // Fallback: If cookie failed, sometimes the local storage is used. 
        // We will stick to cookies as they are more reliable for SSR Next.js apps.

        if (token) {
            authToken = token;
            await readCurrentPage();
        } else {
            showState("unauthenticated");
        }
    } catch (error) {
        console.error("Error checking auth:", error);
        showState("unauthenticated");
    }
}

async function readCurrentPage() {
    try {
        const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });

        const tab = tabs[0];

        // Cannot inject into chrome:// or extension pages
        if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
            showErrorPreview("Página Inválida", "Não é possível capturar desta página.");
            return;
        }

        const results = await new Promise((resolve, reject) => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            }, (res) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(res);
                }
            });
        });

        if (results && results[0] && results[0].result) {
            currentProduct = results[0].result;

            // Populating UI
            document.getElementById("product-title").textContent = currentProduct.title || "Sem Título";

            try {
                document.getElementById("product-url").textContent = new URL(currentProduct.url).hostname;
            } catch {
                document.getElementById("product-url").textContent = currentProduct.url;
            }

            if (currentProduct.imageUrl) {
                document.getElementById("image-container").innerHTML = `<img src="${currentProduct.imageUrl}" alt="Preview" />`;
            }

            showState("capture-state");
        } else {
            throw new Error("Nenhum dado retornado do content.js");
        }
    } catch (e) {
        console.error("Failed to read page", e);
        showErrorPreview("Erro na Leitura", "Tente recarregar a página da loja.");
    }
}

function showErrorPreview(title, msg) {
    document.getElementById("product-title").textContent = title;
    document.getElementById("product-url").textContent = msg;
    document.getElementById("btn-capture").disabled = true;
    showState("capture-state");
}

async function captureProduct() {
    if (!authToken || !currentProduct) return;

    const btn = document.getElementById("btn-capture");
    const originalText = btn.textContent;
    btn.textContent = "Gravando...";
    btn.disabled = true;

    try {
        const response = await fetch(URL_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: currentProduct.title,
                source_url: currentProduct.url,
                image_url: currentProduct.imageUrl
            })
        });

        if (response.ok) {
            showState("success-state");
        } else if (response.status === 401 || response.status === 403) {
            // Token expired or invalid
            showState("unauthenticated");
        } else {
            const err = await response.text();
            throw new Error(`Servidor retornou ${response.status}: ${err}`);
        }
    } catch (error) {
        console.error("Error capturing product:", error);
        alert("Erro ao salvar produto. Verifique se o servidor FastAPI (Arch Smart) está rodando localmente.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function showState(stateId) {
    const states = ["loading", "unauthenticated", "capture-state", "success-state"];
    states.forEach(state => {
        document.getElementById(state).classList.add("hidden");
    });
    document.getElementById(stateId).classList.remove("hidden");
}
