/**
 * Modulo Chat Principale (Core Logic)
 * Richiede che config.js sia caricato.
 */

let chatHistory = [];

// Dichiariamo le variabili vuote
let messageArea, userInput, sendBtn;

// L'equivalente del void Start() in Unity: aspetta che tutta la scena UI sia caricata
document.addEventListener('DOMContentLoaded', () => {
    console.log("⚙️ script.js caricato: inizializzazione riferimenti UI...");
    
    // Assegnazione dei riferimenti
    messageArea = document.getElementById('messages');
    userInput = document.getElementById('user-input');
    sendBtn = document.getElementById('send-btn');

    if (!sendBtn || !userInput) {
        console.error("❌ Errore critico: Elementi UI non trovati! Controlla i nomi degli ID nell'HTML.");
        return;
    }

    // Event Listeners di input (Il nostro OnClick)
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    console.log("✅ Sistema pronto. In attesa di input utente...");
    userInput.focus();
});

/**
 * Gestore principale dell'invio messaggi (Metodo Completo)
 */
async function handleSendMessage() {
    console.log("▶️ Richiesto invio messaggio.");
    const text = userInput.value.trim();
    if (!text) {
        console.log("⚠️ Testo vuoto, comando ignorato.");
        return;
    }

    appendMessage(text, 'user');
    userInput.value = '';
    
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    try {
        if (!window.CONFIG || !window.CONFIG.API_KEY) {
            throw new Error("File config.js non trovato o API Key mancante.");
        }

        console.log("📡 Avvio chiamata API verso:", window.CONFIG.API_URL);
        console.log("🧠 Modello target:", window.CONFIG.MODEL);

        const response = await fetch(window.CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.CONFIG.API_KEY}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Nemotron Web UI'
            },
            body: JSON.stringify({
                model: window.CONFIG.MODEL, 
                messages: chatHistory,
                include_reasoning: true 
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ Errore ritornato dal server OpenRouter:", errorData);
            throw new Error(errorData.error?.message || `Errore Server HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Dati ricevuti con successo:", data);
        
        const messageObj = data.choices[0].message;
        
        let aiResponse = messageObj.content || '';
        let reasoningText = messageObj.reasoning || '';

        const thinkRegex = /<think>([\s\S]*?)<\/think>/;
        const match = aiResponse.match(thinkRegex);
        if (match) {
            reasoningText = match[1].trim() + (reasoningText ? "\n" + reasoningText : "");
            aiResponse = aiResponse.replace(thinkRegex, '').trim(); 
        }

        appendMessage(aiResponse, 'ai', reasoningText);
        chatHistory.push({ role: 'assistant', content: aiResponse });

    } catch (error) {
        console.error('❌ Eccezione catturata durante il ciclo:', error);
        appendMessage(`Errore di sistema: ${error.message}`, 'ai');
        chatHistory.pop(); 
    } finally {
        toggleLoading(false);
    }
}

/**
 * Gestore dell'interfaccia utente
 */
function appendMessage(content, sender, reasoning = null) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    
    if (reasoning && window.ReasoningUI) {
        const reasoningBlock = window.ReasoningUI.createReasoningBlock(reasoning);
        msgDiv.appendChild(reasoningBlock);
    }
    
    const textNode = document.createElement('div');
    textNode.textContent = content;
    msgDiv.appendChild(textNode);
    
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) userInput.focus();
}
