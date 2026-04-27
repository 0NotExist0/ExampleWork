/**
 * Modulo Chat Principale (Core Logic)
 * Richiede che config.js sia caricato prima di questo file.
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

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
        // Null-Check: Verifica che il file di configurazione esista in memoria
        if (!window.CONFIG || !window.CONFIG.API_KEY) {
            throw new Error("File config.js non trovato o API Key mancante.");
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
                include_reasoning: true // Supporto per il reasoning-ui
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Errore API');
        }

        const data = await response.json();
        const messageObj = data.choices[0].message;
        
        let aiResponse = messageObj.content || '';
        let reasoningText = messageObj.reasoning || '';

        // Estrazione del tag <think> se il modello lo inserisce nel testo puro
        const thinkRegex = /<think>([\s\S]*?)<\/think>/;
        const match = aiResponse.match(thinkRegex);
        if (match) {
            reasoningText = match[1].trim() + (reasoningText ? "\n" + reasoningText : "");
            aiResponse = aiResponse.replace(thinkRegex, '').trim(); 
        }

        appendMessage(aiResponse, 'ai', reasoningText);
        chatHistory.push({ role: 'assistant', content: aiResponse });

    } catch (error) {
        console.error('Chat Error:', error);
        appendMessage(`Errore di sistema: ${error.message}`, 'ai');
        chatHistory.pop(); 
    } finally {
        toggleLoading(false);
    }
}

/**
 * Gestore dell'interfaccia utente per l'aggiunta dei messaggi
 */
function appendMessage(content, sender, reasoning = null) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    
    // Integrazione del componente Reasoning se presente nella scena
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

// Event Listeners di input
sendBtn.addEventListener('click', handleSendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});

userInput.focus();
