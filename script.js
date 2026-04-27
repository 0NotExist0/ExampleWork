/**
 * Modulo Chat Principale (Core Logic con Streaming Resiliente)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js avviato con parser Streaming avanzato.");

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

        // PREPARAZIONE UI
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'ai');
        
        const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
        if (liveReasoning) msgDiv.appendChild(liveReasoning.container);
        
        const textNode = document.createElement('div');
        msgDiv.appendChild(textNode);
        
        messageArea.appendChild(msgDiv);
        messageArea.scrollTop = messageArea.scrollHeight;

        // LETTURA DELLO STREAM
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        
        // Variabili di accumulo globali (il nostro Buffer persistente)
        let nativeReasoningBuffer = "";
        let rawContentBuffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Tieni l'ultimo frammento incompleto in memoria

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        const delta = dataObj.choices[0]?.delta;

                        if (!delta) continue;

                        // 1. Accumula dati in arrivo
                        if (delta.reasoning) {
                            nativeReasoningBuffer += delta.reasoning;
                        }
                        if (delta.content) {
                            rawContentBuffer += delta.content;
                        }

                        // 2. Parser Dinamico: ricalcola cosa mostrare ad ogni frame
                        let displayReasoning = nativeReasoningBuffer;
                        let displayContent = rawContentBuffer;

                        // Questa Regex intercetta il tag <think> sia che sia chiuso (</think>) 
                        // sia che sia ancora aperto (|$), prevenendo tagli dovuti al lag di rete
                        const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/i;
                        const match = displayContent.match(thinkRegex);

                        if (match) {
                            // Estrae il pensiero dal buffer del contenuto
                            displayReasoning += (displayReasoning ? "\n" : "") + match[1];
                            // Nasconde il blocco testuale grezzo dalla risposta finale
                            displayContent = displayContent.replace(thinkRegex, '').trimStart();
                        }
                        
                        // 3. Aggiorna l'interfaccia
                        if (displayReasoning && liveReasoning) {
                            liveReasoning.updateText(displayReasoning);
                        }
                        textNode.textContent = displayContent;
                        
                        messageArea.scrollTop = messageArea.scrollHeight;
                        
                    } catch (e) {
                        // Salta JSON rotti senza interrompere il ciclo
                    }
                }
            }
        }

        // Chiusura e salvataggio
        if (liveReasoning) liveReasoning.finish();
        
        // Salviamo nella cronologia solo il testo finale depurato dai tag
        const finalContent = textNode.textContent;
        chatHistory.push({ role: 'assistant', content: finalContent });

    } catch (error) {
        console.error('❌ Errore API:', error);
        appendUserMessage(`Errore di connessione: ${error.message}`, 'ai');
        chatHistory.pop(); 
    } finally {
        toggleLoading(false);
    }
}

/**
 * Utility per il testo utente
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
