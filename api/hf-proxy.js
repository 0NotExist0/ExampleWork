export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { model } = req.query;
    if (!model) return res.status(400).json({ error: 'model mancante' });

    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) return res.status(500).json({ error: 'HF_API_KEY non configurata su Vercel' });

    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${hfKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
    });

    const buffer = await hfRes.arrayBuffer();
    const contentType = hfRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.status(hfRes.status).send(Buffer.from(buffer));
}