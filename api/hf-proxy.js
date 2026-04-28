export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    try {
        const HF_TOKEN = process.env.HF_API_KEY; 
        
        if (!HF_TOKEN) {
            return res.status(500).json({ error: 'Token HuggingFace mancante su Vercel.' });
        }

        let rawModel = req.body.model || 'black-forest-labs/FLUX.1-schnell';
        let modelId = rawModel;
        if (rawModel.includes('huggingface.co/')) {
            modelId = rawModel.split('huggingface.co/')[1].replace('models/', '');
        }

        const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;
        const payload = JSON.stringify({ inputs: req.body.inputs });

        const hfResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`,
                // 🛑 LA MAGIA È QUI: 
                // Cancelliamo i "tracker" di Vercel e forziamo Hugging Face 
                // a credere che la richiesta sia nativa e pulita.
                'X-Forwarded-Host': 'api-inference.huggingface.co',
                'Host': 'api-inference.huggingface.co',
                'X-Forwarded-For': ''
            },
            body: payload
        });

        if (!hfResponse.ok) {
            let errText = await hfResponse.text();
            try {
                const errJson = JSON.parse(errText);
                errText = errJson.error || errText;
            } catch (e) {}
            return res.status(hfResponse.status).json({ error: `HF Error: ${errText}` });
        }

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
        return res.status(500).json({ error: `Errore critico proxy: ${error.message}` });
    }
}
