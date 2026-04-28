export default async function handler(req, res) {
    // Permetti solo richieste POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito. Usa POST.' });
    }

    try {
        // Legge ESATTAMENTE la variabile chiamata HF_API_KEY (come nel tuo screenshot)
        const HF_TOKEN = process.env.HF_API_KEY; 
        
        if (!HF_TOKEN) {
            return res.status(500).json({ error: 'Token HuggingFace mancante sul server Vercel.' });
        }

        // URL del modello Flux
        const modelUrl = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

        const hfResponse = await fetch(modelUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: JSON.stringify(req.body) // Passa "Genera un topo"
        });

        if (!hfResponse.ok) {
            const errText = await hfResponse.text();
            return res.status(hfResponse.status).json({ error: `Errore HuggingFace: ${errText}` });
        }

        // Recupera l'immagine e la rimanda al frontend
        const imageBuffer = await hfResponse.arrayBuffer();
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        console.error("Errore nel proxy:", error);
        return res.status(500).json({ error: `Errore interno: ${error.message}` });
    }
}
