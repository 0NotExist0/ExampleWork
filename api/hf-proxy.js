export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito. Usa POST.' });
    }

    try {
        const HF_TOKEN = process.env.HF_API_KEY; 
        
        if (!HF_TOKEN) {
            return res.status(500).json({ error: 'Token HuggingFace mancante sul server Vercel.' });
        }

        // ⚠️ IL BERSAGLIO ESATTO: nota la dicitura "api-inference" all'inizio dell'URL!
        const modelUrl = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

        // Sicurezza extra per evitare che il payload venga formattato male
        const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

        const hfResponse = await fetch(modelUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: payload
        });

        if (!hfResponse.ok) {
            const errText = await hfResponse.text();
            return res.status(hfResponse.status).json({ error: `Errore HuggingFace: ${errText}` });
        }

        const imageBuffer = await hfResponse.arrayBuffer();
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        console.error("Errore nel proxy:", error);
        return res.status(500).json({ error: `Errore interno: ${error.message}` });
    }
}
