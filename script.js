/**
 * Configurazione Modulo Chat per Nemotron 3 Super
 * Integrazione tramite OpenRouter API
 */

const CONFIG = {
    API_KEY: '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',
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MODEL: 'nvidia/nemotron-4-340b-instruct'
};

// Stato dell'applicazione per mantenere il contesto
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

    // 1. Aggiorna UI con messaggio utente
    appendMessage(text, 'user');
    userInput.value = '';
    
    // 2. Prepara il payload per l'API aggiornando la history
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Nemotron Web UI'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: chatHistory
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Errore nella richiesta API');
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        // 3. Aggiorna UI con risposta AI e salva in history
        appendMessage(aiResponse, 'ai');
        chatHistory.push({ role: 'assistant', content: aiResponse });

    } catch (error) {
        console.error('Chat Error:', error);
        appendMessage(`Errore: ${error.message}. Verifica la tua API Key o la connessione.`, 'ai');
        // Rimuovi l'ultimo input utente dalla history in caso di errore
        chatHistory.pop();
    } finally {
        toggleLoading(false);
    }
}

/**
 * Aggiunge un blocco di testo (fumetto) all'area chat
 */
function appendMessage(content, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    
    // Scroll automatico alla base
    messageArea.scrollTop = messageArea.scrollHeight;
}

/**
 * Disabilita/Abilita i controlli durante l'attesa di rete
 */
function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) userInput.focus();
}

// Event Listeners per mouse e tastiera
sendBtn.addEventListener('click', handleSendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});

// Focus iniziale per usabilità immediata
userInput.focus();
