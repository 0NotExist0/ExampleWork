/**
 * Modulo Chat Principale (Core Logic con Failsafe, Garbage Collection e Cursore Live)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js avviato con Failsafe e Garbage Collection attiva.");

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
 * Gestore principale dell'invio (Metodo Completo)
 */
async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

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
                stream: true 
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Errore HTTP ${response.status}`);
        }

        // ISTANZIAZIONE DEL PREFAB UI
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'ai');
        
        const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
        if (liveReasoning) msgDiv.appendChild(liveReasoning.container);
        
        const textNode = document.createElement('div');
        textNode.textContent = "▮"; // Cursore di caricamento iniziale
        msgDiv.appendChild(textNode);
        
        messageArea.appendChild(msgDiv);
        messageArea.scrollTop = messageArea.scrollHeight;

        // LETTURA DELLO STREAM
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        
        let nativeReasoningBuffer = "";
        let rawContentBuffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); 

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        const delta = dataObj.choices[0]?.delta;
                        if (!delta) continue;

                        if (delta.reasoning) nativeReasoningBuffer += delta.reasoning;
                        if (delta.content) rawContentBuffer += delta.content;

                        // PARSER SEMPLIFICATO E SICURO
                        let displayContent = "";
                        let displayReasoning = "";

                        let thinkStart = rawContentBuffer.indexOf('<think>');
                        if (thinkStart !== -1) {
                            let thinkEnd = rawContentBuffer.indexOf('</think>', thinkStart);
                            if (thinkEnd !== -1) {
                                // Tag chiuso: prendiamo il testo prima e dopo il tag
                                displayContent = rawContentBuffer.substring(0, thinkStart) + rawContentBuffer.substring(thinkEnd + 8);
                                displayReasoning = rawContentBuffer.substring(thinkStart + 7, thinkEnd);
                            } else {
                                // Tag aperto: tutto ciò che c'è dopo <think> è ragionamento in corso
                                displayContent = rawContentBuffer.substring(0, thinkStart);
                                displayReasoning = rawContentBuffer.substring(thinkStart + 7);
                            }
                        } else {
                            // Nessun tag presente
                            displayContent = rawContentBuffer;
                        }

                        let finalReasoning = (nativeReasoningBuffer + "\n" + displayReasoning).trim();
                        
                        // Aggiorna la UI in tempo reale, aggiungendo il cursore lampeggiante alla fine del testo
                        if (finalReasoning && liveReasoning) {
                            liveReasoning.updateText(finalReasoning);
                        }
                        textNode.textContent = displayContent.trimStart() + " ▮";
                        
                        messageArea.scrollTop = messageArea.scrollHeight;
                        
                    } catch (e) {
                        // Salta frame corrotti
                    }
                }
            }
        }

        // --- FINE STREAM E GARBAGE COLLECTION ---
        
        // 1. Rimuove il cursore lampeggiante
        let finalContent = textNode.textContent.replace(" ▮", "").replace("▮", "").trim();
        textNode.textContent = finalContent;

        if (liveReasoning) {
            const hasReasoning = (nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
            liveReasoning.finish(hasReasoning);
        }

        // 2. Failsafe: Se il div è vuoto (il modello non ha detto nulla), distruggiamo il GameObject
        if (finalContent === "" && nativeReasoningBuffer === "" && !rawContentBuffer.includes('<think>')) {
            console.warn("⚠️ Ricevuta risposta vuota dal server. Eseguo il Destroy del nodo UI.");
            messageArea.removeChild(msgDiv); // Destroy(gameObject)
            appendUserMessage("⚠️ Il modello non ha fornito alcuna risposta. Potrebbe essere sovraccarico.", 'ai');
            chatHistory.pop(); // Rimuoviamo la nostra domanda dalla history per non corrompere il contesto
        } else {
            chatHistory.push({ role: 'assistant', content: finalContent });
        }

    } catch (error) {
        console.error('❌ Errore API:', error);
        appendUserMessage(`Errore di connessione: ${error.message}`, 'ai');
        chatHistory.pop(); 
    } finally {
        toggleLoading(false);
    }
}

/**
 * Utility grafica
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
