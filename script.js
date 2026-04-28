/**
 * NEMOADAM CLOUD UI - Core Logic
 * Gestione Text Streaming, Image Generation Proxy & HF Catalog Sync
 */

let chatHistory = [];

// Elementi UI
const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const catalogContainer = document.querySelector('.catalog-grid') || document.getElementById('catalog-items');

console.log("⚙️ script.js caricato. Sistema di sincronizzazione catalogo HF attivo.");

// ─── INIZIALIZZAZIONE ────────────────────────────────────────────────────────

if (!sendBtn || !userInput || !messageArea) {
    console.error("❌ Errore: Elementi UI critici mancanti.");
} else {
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    userInput.focus();
    
    // Avvia la scansione dei modelli gratuiti all'apertura
    syncHuggingFaceCatalog();
}

// ─── SINCRONIZZAZIONE CATALOGO MODELLI ───────────────────────────────────────

/**
 * Recupera i modelli text-to-image gratuiti da HF e popola la UI
 */
async function syncHuggingFaceCatalog() {
    console.log("📡 Scansione modelli gratuiti su Hugging Face...");
    const limit = 50; // Recuperiamo i primi 50 modelli più popolari
    const url = `https://huggingface.co/api/models?pipeline_tag=text-to-image&sort=downloads&direction=-1&limit=${limit}&filter=inference`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Impossibile contattare HF");
        const models = await response.json();

        if (catalogContainer) {
            catalogContainer.innerHTML = ""; // Pulisce il catalogo esistente
            
            models.forEach(m => {
                const card = document.createElement('div');
                card.style.cssText = "padding:10px; background:#1a1a1a; border:1px solid #333; border-radius:5px; cursor:pointer; margin:5px; font-size:12px; transition: 0.3s;";
                card.innerHTML = `
                    <div style="color:#00ff88; font-weight:bold; overflow:hidden; text-overflow:ellipsis;">${m.id.split('/')[1] || m.id}</div>
                    <div style="color:#888; font-size:10px;">Autore: ${m.author || 'Innocuo'}</div>
                    <div style="color:#555; font-size:9px;">⬇️ ${m.downloads.toLocaleString()}</div>
                `;
                
                card.onclick = () => selectModel(m.id);
                card.onmouseover = () => card.style.borderColor = "#00ff88";
                card.onmouseout = () => card.style.borderColor = "#333";
                
                catalogContainer.appendChild(card);
            });
            console.log(`✅ Catalogo popolato con ${models.length} modelli.`);
        }
    } catch (e) {
        console.error("❌ Errore sincronizzazione catalogo:", e);
    }
}

function selectModel(modelId) {
    if (window.CONFIG) {
        window.CONFIG.MODEL = modelId;
        window.CONFIG.PROVIDER = 'huggingface';
        
        // Aggiorna badge visivo se esiste
        const badge = document.querySelector('.current-model-badge') || document.querySelector('.status-bar span');
        if (badge) badge.textContent = `MODELLO: ${modelId.toUpperCase()}`;
        
        appendUserMessage(`Sistema: Modello impostato su ${modelId}`, 'ai');
    }
}

// ─── GESTIONE MESSAGGI ───────────────────────────────────────────────────────

async function handleSendMessage() {
    if (sendBtn.disabled) return;

    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    toggleLoading(true);

    let msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    const contentNode = document.createElement('div');
    contentNode.style.cssText = "white-space: pre-wrap; word-break: break-word;";
    contentNode.textContent = "⌛ Elaborazione...";
    msgDiv.appendChild(contentNode);
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;

    if (typeof window.CONFIG === 'undefined') {
        contentNode.textContent = "❌ Errore: CONFIG non caricato.";
        toggleLoading(false);
        return;
    }

    const provider = window.CONFIG.PROVIDER || 'openrouter';
    const activeToken = window.CONFIG._activeKey || window.CONFIG.API_KEY;
    const model = window.CONFIG.MODEL;

    try {
        // --- RAMO IMMAGINI (HuggingFace Proxy) ---
        if (provider === 'huggingface') {
            contentNode.textContent = "🎨 Generazione immagine in corso...▮";

            const response = await fetch('/api/hf-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: text, model: model })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Errore HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const json = await response.json();
                const imgSrc = json?.[0]?.url || json?.url || json?.image;
                if (imgSrc) renderImage(imgSrc, text, contentNode);
                else throw new Error("Risposta JSON valida ma immagine non trovata.");
            } else {
                const blob = await response.blob();
                renderImage(URL.createObjectURL(blob), text, contentNode);
            }
            chatHistory.push({ role: 'assistant', content: `[Immagine: ${text}]` });
        } 
        
        // --- RAMO TESTO (Streaming) ---
        else {
            contentNode.textContent = "▮";
            const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
            if (liveReasoning) msgDiv.insertBefore(liveReasoning.container, contentNode);

            const response = await fetch(window.CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'NemoAdam Cloud'
                },
                body: JSON.stringify({ model: model, messages: chatHistory, stream: true })
            });

            if (!response.ok) throw new Error("Errore nella risposta del server.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let rawBuffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (let line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const content = data.choices[0].delta.content || "";
                            rawBuffer += content;
                            contentNode.textContent = rawBuffer + " ▮";
                            messageArea.scrollTop = messageArea.scrollHeight;
                        } catch (e) {}
                    }
                }
            }
            contentNode.textContent = rawBuffer;
            chatHistory.push({ role: 'assistant', content: rawBuffer });
        }
    } catch (error) {
        console.error("❌ ERRORE:", error);
        contentNode.textContent = `❌ Errore: ${error.message}`;
        contentNode.style.color = "#ef4444";
    } finally {
        toggleLoading(false);
    }
}

// ─── HELPERS UI ──────────────────────────────────────────────────────────────

function appendUserMessage(content, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function renderImage(src, prompt, container) {
    container.textContent = "";
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = "max-width:100%; border-radius:8px; margin-top:10px; border: 2px solid #00ff88; box-shadow: 0 0 15px rgba(0,255,136,0.2);";
    img.onload = () => messageArea.scrollTop = messageArea.scrollHeight;
    container.appendChild(img);
}

function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) userInput.focus();
}
