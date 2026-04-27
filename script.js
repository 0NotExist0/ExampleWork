/**
 * Modulo Chat Principale (Core Logic con Streaming In-Diretta)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js avviato con modulo Streaming.");

if (!sendBtn || !userInput) {
    console.error("❌ Errore: Elementi UI non trovati!");
} else {
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    userInput.focus();
}

/**
 * Gestore principale dell'invio (Metodo Streaming Completo)
 */
async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Aggiungi il messaggio dell'utente alla UI e alla history
    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    try {
        if (!window.CONFIG || !window.CONFIG.API_KEY) {
            throw new Error("Dati di configurazione mancanti.");
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
                include_reasoning: true,
                stream: true // ⬅️ LA MAGIA E' QUI: abilitiamo lo streaming!
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Errore HTTP ${response.status}`);
        }

        // PREPARAZIONE UI: Creiamo il contenitore del messaggio IA vuoto
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'ai');
        
        // Istanziamo il componente logico (se c'è)
        const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
        if (liveReasoning) msgDiv.appendChild(liveReasoning.container);
        
        // Nodo per la risposta finale testuale
        const textNode = document.createElement('div');
        msgDiv.appendChild(textNode);
        
        messageArea.appendChild(msgDiv);
        messageArea.scrollTop = messageArea.scrollHeight;

        // LETTURA DELLO STREAM
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        
        let fullAiResponse = "";
        let fullReasoningText = "";
        let isInsideThinkTag = false; // Macchina a stati per i tag <think>

        // Coroutine per la lettura dei chunk
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Mantiene in memoria il frammento tagliato a metà

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        const delta = dataObj.choices[0].delta;

                        // 1. Gestione Reasoning Nativi OpenRouter
                        if (delta.reasoning) {
                            fullReasoningText += delta.reasoning;
                            if (liveReasoning) liveReasoning.updateText(fullReasoningText);
                        }

                        // 2. Gestione Contenuto e Tag <think> in tempo reale
                        if (delta.content) {
                            let contentChunk = delta.content;

                            if (contentChunk.includes('<think>')) {
                                isInsideThinkTag = true;
                                contentChunk = contentChunk.replace('<think>', '');
                            }
                            if (contentChunk.includes('</think>')) {
                                isInsideThinkTag = false;
                                contentChunk = contentChunk.replace('</think>', '');
                            }

                            if (isInsideThinkTag) {
                                fullReasoningText += contentChunk;
                                if (liveReasoning) liveReasoning.updateText(fullReasoningText);
                            } else {
                                fullAiResponse += contentChunk;
                                textNode.textContent = fullAiResponse; // Aggiorna in diretta
                            }
                        }
                        
                        // Auto-scroll durante la generazione
                        messageArea.scrollTop = messageArea.scrollHeight;
                        
                    } catch (e) {
                        // Ignora JSON incompleti nel buffer ed elabora il prossimo frame
                    }
                }
            }
        }

        // Chiusura fine stream
        if (liveReasoning) liveReasoning.finish();
        chatHistory.push({ role: 'assistant', content: fullAiResponse });

    } catch (error) {
        console.error('❌ Errore:', error);
        appendUserMessage(`Errore di sistema: ${error.message}`, 'ai');
        chatHistory.pop(); 
    } finally {
        toggleLoading(false);
    }
}

/**
 * Helper per il messaggio utente (statico)
 */
function appendUserMessage(content, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) userInput.focus();
}
