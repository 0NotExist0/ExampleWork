export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    try {
        const HF_TOKEN = process.env.HF_API_KEY; 
        
        if (!HF_TOKEN) {
            return res.status(500).json({ error: 'Token HuggingFace mancante su Vercel.' });
        }

        // 1. Legge il modello inviato dalla tua UI (o usa Flux di base)
        let rawModel = req.body.model || 'black-forest-labs/FLUX.1-schnell';

        // 2. PULIZIA AUTOMATICA: Se per sbaglio usi l'URL del sito web, estraiamo solo l'ID
        let modelId = rawModel;
        if (rawModel.includes('huggingface.co/')) {
            modelId = rawModel.split('huggingface.co/')[1].replace('models/', '');
        }

        // 3. COSTRUZIONE URL CORRETTO: Forziamo sempre il server API "api-inference"
        const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;
        console.log("📡 URL Bersaglio corretto:", apiUrl);

        // 4. Prepariamo il pacchetto dati esatto che Hugging Face si aspetta
        const payload = JSON.stringify({ inputs: req.body.inputs });

        const hfResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: payload
        });

        if (!hfResponse.ok) {
            const errText = await hfResponse.text();
            return res.status(hfResponse.status).json({ error: `Errore HF: ${errText}` });
        }

        // Se HF restituisce JSON (es. un URL dell'immagine), passalo al frontend
        const contentType = hfResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const json = await hfResponse.json();
            return res.status(200).json(json);
        }

        // Se HF restituisce l'immagine vera e propria, mandiamola
        const imageBuffer = await hfResponse.arrayBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        console.error("Errore proxy:", error);
        return res.status(500).json({ error: `Errore interno: ${error.message}` });
    }
}
