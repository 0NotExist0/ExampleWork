/**
 * Modulo Chat Principale (Core Logic)
 * Richiede config.js
 */

let chatHistory = [];

// Riferimenti diretti (come variabili pubbliche assegnate dall'Inspector)
const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Inizializzazione immediata
console.log("⚙️ script.js avviato. Configurazione attuale:", window.CONFIG);

if (!sendBtn || !userInput) {
    console.error("❌ Errore critico: Elementi UI non trovati!");
} else {
    // Assegna gli eventi
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    console.log("✅ Sistema pronto.");
    userInput.focus();
}

/**
 * Gestore principale dell'invio messaggi (Metodo Completo)
 */
async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    userInput.value = '';
    
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    try {
        // Controllo di sicurezza su config.js
        if (!window.CONFIG || !window.CONFIG.API_KEY) {
            throw new Error("Dati di configurazione mancanti. config.js è stato caricato?");
        }

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
            throw new Error(errorData.error?.message || `Errore HTTP ${response.status}`);
        }

        const data = await response.json();
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
        console.error('❌ Errore:', error);
        appendMessage(`Errore di sistema: ${error.message}`, 'ai');
        chatHistory.pop(); 
    } finally {
        toggleLoading(false);
    }
}

/**
 * Generazione grafica dei messaggi
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
