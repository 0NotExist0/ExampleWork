/**
 * script.js
 * Responsabilità: Motore di invio messaggi, gestione UI della chat, streaming dati, renderizzazione immagini.
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ Motore Chat (script.js) inizializzato.");

if (!sendBtn || !userInput || !messageArea) {
    console.error("❌ Errore: Elementi DOM della chat mancanti.");
} else {
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    userInput.focus();
}

async function handleSendMessage() {
    if (sendBtn.disabled) return;

    const text = userInput.value.trim();
    if (!text) return;

    // 1. Aggiungi messaggio utente alla UI
    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    toggleLoading(true);

    // 2. Crea il blocco per la risposta AI
    let msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    const contentNode = document.createElement('div');
    contentNode.style.cssText = "white-space: pre-wrap; word-break: break-word;";
    contentNode.textContent = "⌛ Elaborazione in corso...";
    msgDiv.appendChild(contentNode);
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;

    // 3. Verifica configurazione dal model_selector.js
    if (typeof window.CONFIG === 'undefined' || !window.CONFIG.MODEL) {
        contentNode.textContent = "❌ Errore: Nessun modello selezionato o CONFIG non inizializzato.";
        toggleLoading(false);
        return;
    }

    const provider = window.CONFIG.PROVIDER || 'openrouter';
    const activeToken = window.CONFIG._activeKey || window.CONFIG.API_KEY || '';
    const model = window.CONFIG.MODEL;

    try {
        // --- RAMO IMMAGINI (Proxy server-side per HuggingFace) ---
        if (provider === 'huggingface') {
            contentNode.textContent = "🎨 Creazione immagine tramite modello remoto...▮";

            const response = await fetch(window.CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: text, model: model })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`[404] Modello remoto (${model}) spento o irraggiungibile per gli account gratuiti.`);
                } else if (response.status === 503) {
                    throw new Error(`[503] Il server HF sta accendendo il modello. Riprova tra poco.`);
                }
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Errore HTTP Server: ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const json = await response.json();
                const imgSrc = json?.[0]?.url || json?.url || json?.image;
                if (imgSrc) renderImage(imgSrc, contentNode);
                else throw new Error("JSON valido restituito, ma nessuna immagine trovata nel payload.");
            } else {
                const blob = await response.blob();
                renderImage(URL.createObjectURL(blob), contentNode);
            }
            chatHistory.push({ role: 'assistant', content: `[Immagine generata per: ${text}]` });
        } 
        
        // --- RAMO TESTO (Streaming da OpenRouter) ---
        else {
            contentNode.textContent = "▮";
            
            const response = await fetch(window.CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'NemoAdam Cloud Engine'
                },
                body: JSON.stringify({ model: model, messages: chatHistory, stream: true })
            });

            if (!response.ok) throw new Error(`Errore connessione API Testuale: ${response.status}`);

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
                            const deltaContent = data.choices[0]?.delta?.content || "";
                            rawBuffer += deltaContent;
                            contentNode.textContent = rawBuffer + " ▮";
                            messageArea.scrollTop = messageArea.scrollHeight;
                        } catch (e) {
                            // Silenziamo errori di parsing sui frammenti JSON incompleti del server
                        }
                    }
                }
            }
            contentNode.textContent = rawBuffer; // Rimuove il cursore finale
            chatHistory.push({ role: 'assistant', content: rawBuffer });
        }
    } catch (error) {
        console.error("❌ ERRORE MOTORE:", error);
        contentNode.textContent = `❌ Eccezione Motore: ${error.message}`;
        contentNode.style.color = "#ef4444";
    } finally {
        toggleLoading(false);
    }
}

// --- UTILITY DELLA CHAT ---

function appendUserMessage(content, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function renderImage(src, container) {
    container.textContent = "";
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = "max-width:100%; border-radius:8px; margin-top:10px; border: 2px solid #00ff88; box-shadow: 0 0 15px rgba(0,255,136,0.2); transition: 0.3s ease-in-out;";
    img.onload = () => messageArea.scrollTop = messageArea.scrollHeight;
    container.appendChild(img);
}

function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) userInput.focus();
}
