/**
 * Configurazione Modulo Chat per Nemotron 3 Super
 * Integrazione tramite OpenRouter API
 */

// Creiamo un namespace globale accessibile da tutti i file JS
window.CONFIG = {
    API_KEY: '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',
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MODEL: 'nvidia/nemotron-4-340b-instruct' // Modello di avvio predefinito
};

// Stato dell'applicazione
let chatHistory = [];

// Elementi DOM
const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

/**
 * Gestore principale dell'invio messaggi (Metodo Completo)
 */
async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // 1. Aggiorna UI
    appendMessage(text, 'user');
    userInput.value = '';
    
    // 2. Prepara il payload
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    try {
        // Stampiamo in console il modello esatto che stiamo per usare
        console.log("Inviando richiesta API usando il modello:", window.CONFIG.MODEL);

        const response = await fetch(window.CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.CONFIG.API_KEY}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Nemotron Web UI'
            },
            body: JSON.stringify({
                // Legge dinamicamente il modello aggiornato dal secondo script!
                model: window.CONFIG.MODEL, 
                messages: chatHistory
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Errore nella richiesta API');
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        // 3. Mostra risposta
        appendMessage(aiResponse, 'ai');
        chatHistory.push({ role: 'assistant', content: aiResponse });

    } catch (error) {
        console.error('Chat Error:', error);
        appendMessage(`Errore API: ${error.message}`, 'ai');
        chatHistory.pop(); // Rimuove l'ultimo messaggio per non corrompere la cronologia
    } finally {
        toggleLoading(false);
    }
}

/**
 * Aggiunge il fumetto alla chat
 */
function appendMessage(content, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

/**
 * Gestione bottoni
 */
function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) userInput.focus();
}

// Listeners
sendBtn.addEventListener('click', handleSendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});

userInput.focus();
