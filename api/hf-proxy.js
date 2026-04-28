export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Metodo non consentito');

    try {
        const HF_TOKEN = process.env.HF_API_KEY;
        if (!HF_TOKEN) return res.status(500).json({ error: 'Chiave HF_API_KEY mancante su Vercel.' });

        // Recupera il modello dalla richiesta
        const modelId = req.body.model || 'runwayml/stable-diffusion-v1-5';
        
        // Costruiamo l'URL in modo ultra-pulito
        const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;

        console.log(`📡 Chiamata a: ${apiUrl}`);

        const hfResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: req.body.inputs }),
            redirect: 'error' // 🛑 Se prova a rimbalzarci sul sito web, lancia un errore invece di fallire con l'HTML
        });

        if (!hfResponse.ok) {
            const status = hfResponse.status;
            const text = await hfResponse.text();
            return res.status(status).json({ 
                error: `Hugging Face ha risposto con errore ${status}. Probabilmente il modello '${modelId}' non è disponibile gratuitamente o il token non è valido.`,
                details: text.substring(0, 200)
            });
        }

        const imageBuffer = await hfResponse.arrayBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        return res.status(500).json({ error: `Errore Proxy: ${error.message}` });
    }
}
