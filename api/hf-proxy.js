export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito. Usa POST.' });
    }

    try {
        const HF_TOKEN = process.env.HF_API_KEY; 
        
        if (!HF_TOKEN) {
            return res.status(500).json({ error: 'Token HuggingFace mancante su Vercel.' });
        }

        // 1. Legge il modello dalla UI (di base prova Flux)
        let rawModel = req.body.model || 'black-forest-labs/FLUX.1-schnell';

        let modelId = rawModel;
        if (rawModel.includes('huggingface.co/')) {
            modelId = rawModel.split('huggingface.co/')[1].replace('models/', '');
        }

        const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;
        const payload = JSON.stringify({ inputs: req.body.inputs });

        // 2. Chiamata ad API Hugging Face con blocco dei reindirizzamenti
        const hfResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: payload,
            redirect: 'manual' // 🛑 CRITICO: Impedisce di finire sulla pagina HTML di errore
        });

        // 3. Gestione esplicita del Redirect (Il colpevole di "Cannot POST")
        if (hfResponse.status >= 300 && hfResponse.status < 400) {
            const redirectUrl = hfResponse.headers.get('location') || 'sconosciuto';
            return res.status(403).json({ 
                error: `HF ha rifiutato l'accesso API per ${modelId}. Motivi comuni: Il modello è troppo pesante per il tier gratuito, richiede l'accettazione dei termini sul sito, o il token non ha i permessi Inference. Cambia modello nella UI (es. stabilityai/stable-diffusion-xl-base-1.0).` 
            });
        }

        // 4. Gestione altri errori standard
        if (!hfResponse.ok) {
            let errText = await hfResponse.text();
            try {
                // Prova a estrarre un messaggio JSON pulito se esiste
                const errJson = JSON.parse(errText);
                errText = errJson.error || errText;
            } catch (e) {}
            return res.status(hfResponse.status).json({ error: `Hugging Face Error: ${errText}` });
        }

        // 5. Restituzione Immagine o JSON
        const contentType = hfResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const json = await hfResponse.json();
            return res.status(200).json(json);
        }

        const imageBuffer = await hfResponse.arrayBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        console.error("Errore proxy:", error);
        return res.status(500).json({ error: `Errore critico del server Proxy: ${error.message}` });
    }
}
