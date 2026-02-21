// Executado no contexto da página da loja
function scrapeProduct() {
    const title = document.title || "Produto sem título";
    const url = window.location.href;

    // Tentar encontrar a imagem original (Open Graph ou Twitter Card)
    const ogImage = document.querySelector('meta[property="og:image"]');
    const twImage = document.querySelector('meta[name="twitter:image"]');

    // Fallback para a maior imagem na tela caso as meta tags não existam
    let heroImage = "";
    if (ogImage && ogImage.content) {
        heroImage = ogImage.content;
    } else if (twImage && twImage.content) {
        heroImage = twImage.content;
    } else {
        const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.width > 200 && img.height > 200);
        if (imgs.length > 0) {
            heroImage = imgs[0].src;
        }
    }

    return { title, url, imageUrl: heroImage };
}

// O resultado é retornado para a extensão
scrapeProduct();
