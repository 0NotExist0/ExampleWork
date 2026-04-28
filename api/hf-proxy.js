/**
 * Proxy Vercel serverless per HuggingFace Inference API
 * Evita il blocco CORS dal browser.
 * 
 * SETUP: Aggiungi HF_API_KEY nelle Environment Variables di Vercel.
 * URL chiamata: /api/hf-proxy?model=black-forest-labs/FLUX.1-schnell
 */
export default async function handler(req, res) {
    // Solo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const model = req.query.model;
    if (!model) {
        return res.status(400).json({ error: 'Parametro "model" mancante nella query string.' });
    }

    // Leggi la chiave HF dalle env vars di Vercel (mai esposta al client)
    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) {
        return res.status(500).json({
            error: 'HF_API_KEY non configurata. Aggiungila nelle Environment Variables di Vercel.'
        });
    }

    try {
        const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });

        // Passa il Content-Type originale (image/png, application/json, ecc.)
        const contentType = hfRes.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Passa il body binario (immagine) o JSON invariato
        const buffer = await hfRes.arrayBuffer();
        return res.status(hfRes.status).send(Buffer.from(buffer));

    } catch (err) {
        console.error('[hf-proxy] Errore:', err);
        return res.status(502).json({ error: `Errore proxy: ${err.message}` });
    }
}
