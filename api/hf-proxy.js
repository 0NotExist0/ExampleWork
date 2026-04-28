export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    try {
        const HF_TOKEN = process.env.HF_API_KEY; 
        
        if (!HF_TOKEN) {
            return res.status(500).json({ error: 'Token HuggingFace mancante.' });
        }

        // ⚠️ TEST: Cambiamo modello passando a Stable Diffusion XL (SDXL) che è sempre gratuito
        const modelUrl = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';

        const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

        const hfResponse = await fetch(modelUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: payload,
            redirect: 'manual' // 🛑 BLOCCA il reindirizzamento alla pagina web per evitare l'errore HTML!
        });

        // Se Hugging Face cerca di buttarci fuori dall'API...
        if (hfResponse.status >= 300 && hfResponse.status < 400) {
            const location = hfResponse.headers.get('location');
            return res.status(500).json({ 
                error: `Hugging Face ha bloccato l'accesso API. Motivo probabile: il token non ha i permessi di 'Inference' oppure il modello richiede l'abbonamento PRO. Reindirizzato a: ${location}` 
            });
        }

        if (!hfResponse.ok) {
            const errText = await hfResponse.text();
            return res.status(hfResponse.status).json({ error: `Errore HF: ${errText}` });
        }

        const imageBuffer = await hfResponse.arrayBuffer();
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        console.error("Errore proxy:", error);
        return res.status(500).json({ error: `Errore interno: ${error.message}` });
    }
}
