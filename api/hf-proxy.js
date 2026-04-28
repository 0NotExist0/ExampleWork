// File: api/hf-proxy.js

export default async function handler(req, res) {
    // Permetti solo richieste POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito. Usa POST.' });
    }

    try {
        // Recupera il token da Vercel (assicurati che il nome della variabile sia esatto)
        const HF_TOKEN = process.env.hf_JxCjv_INSERISCI_IL_RESTO_QUI; // Sostituisci con il nome reale della tua env var
        
        if (!HF_TOKEN) {
            return res.status(500).json({ error: 'Token HuggingFace mancante sul server Vercel.' });
        }

        // Il modello che vuoi usare (puoi anche passarlo dal frontend)
        const modelUrl = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

        const hfResponse = await fetch(modelUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: JSON.stringify(req.body) // Passa il payload { inputs: "Gejera un pollo" }
        });

        if (!hfResponse.ok) {
            const errText = await hfResponse.text();
            return res.status(hfResponse.status).json({ error: `Errore HuggingFace: ${errText}` });
        }

        // Recupera l'immagine come ArrayBuffer
        const imageBuffer = await hfResponse.arrayBuffer();
        
        // Imposta gli header corretti per restituire un'immagine binaria
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        
        // Invia il buffer al frontend
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        console.error("Errore nel proxy:", error);
        return res.status(500).json({ error: `Errore interno del server proxy: ${error.message}` });
    }
}
