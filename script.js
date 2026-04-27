/**
 * Configurazione Modulo Chat Principale
 */
window.CONFIG = {
    API_KEY: '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',
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MODEL: 'nvidia/nemotron-4-340b-instruct'
};

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

/**
 * Gestore principale dell'invio messaggi (Metodo Completo Aggiornato)
 */
async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    userInput.value = '';
    
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    try {
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
                include_reasoning: true // Forza OpenRouter a inviare il ragionamento se supportato
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Errore API');
        }

        const data = await response.json();
        const messageObj = data.choices[0].message;
        
        let aiResponse = messageObj.content || '';
        let reasoningText = messageObj.reasoning || ''; // Estrazione parametro nativo

        // Fallback: Parsing dei tag <think> se il modello li inietta nel body del testo
        const thinkRegex = /<think>([\s\S]*?)<\/think>/;
        const match = aiResponse.match(thinkRegex);
        if (match) {
            reasoningText = match[1].trim() + (reasoningText ? "\n" + reasoningText : "");
            aiResponse = aiResponse.replace(thinkRegex, '').trim(); // Rimuove il tag dal messaggio finale
        }

        // Passa sia il messaggio che il ragionamento (se presente) all'UI
        appendMessage(aiResponse, 'ai', reasoningText);
        chatHistory.push({ role: 'assistant', content: aiResponse });

    } catch (error) {
        console.error('Chat Error:', error);
        appendMessage(`Errore API: ${error.message}`, 'ai');
        chatHistory.pop(); 
    } finally {
        toggleLoading(false);
    }
}

/**
 * Genera il fumetto della chat supportando il Componente di Ragionamento
 */
function appendMessage(content, sender, reasoning = null) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    
    // Controlla se abbiamo del ragionamento E se lo script UI è stato caricato
    if (reasoning && window.ReasoningUI) {
        const reasoningBlock = window.ReasoningUI.createReasoningBlock(reasoning);
        msgDiv.appendChild(reasoningBlock);
    }
    
    // Contenitore per il testo del messaggio normale
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

sendBtn.addEventListener('click', handleSendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});

userInput.focus();
