/**
 * Modulo Chat Principale (Core Logic con Streaming Frame-Perfect)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js avviato con parser Streaming su base index.");

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

        // LETTURA DELLO STREAM IN TEMPO REALE
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

                        // Accumula i chunk grezzi
                        if (delta.reasoning) nativeReasoningBuffer += delta.reasoning;
                        if (delta.content) rawContentBuffer += delta.content;

                        // PARSER ROBUSTO (Resiliente ai pacchetti tagliati)
                        let cStr = "";
                        let rStr = "";
                        let curr = 0;
                        
                        while(true) {
                            let startTag = rawContentBuffer.indexOf('<think>', curr);
                            if (startTag === -1) {
                                // Nessun tag di inizio, tutto il resto è testo normale
                                cStr += rawContentBuffer.substring(curr);
                                break;
                            }
                            // Aggiungi il testo prima del <think>
                            cStr += rawContentBuffer.substring(curr, startTag);
                            
                            let endTag = rawContentBuffer.indexOf('</think>', startTag + 7);
                            if (endTag === -1) {
                                // Tag aperto ma non ancora chiuso (stiamo ancora streammando il pensiero)
                                rStr += rawContentBuffer.substring(startTag + 7);
                                break;
                            } else {
                                // Tag aperto e chiuso
                                rStr += rawContentBuffer.substring(startTag + 7, endTag) + "\n";
                                curr = endTag + 8;
                            }
                        }

                        let finalReasoning = (nativeReasoningBuffer + "\n" + rStr).trim();
                        
                        // AGGIORNAMENTO UI IN DIRETTA
                        if (finalReasoning && liveReasoning) {
                            liveReasoning.updateText(finalReasoning);
                        }
                        textNode.textContent = cStr.trimStart();
                        
                        messageArea.scrollTop = messageArea.scrollHeight;
                        
                    } catch (e) {
                        // Ignoriamo micro-errori JSON per non bloccare il loop
                    }
                }
            }
        }

        // CHIUSURA STREAM (Update Finale)
        if (liveReasoning) {
            const hasReasoning = (nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
            liveReasoning.finish(hasReasoning);
        }
        
        chatHistory.push({ role: 'assistant', content: textNode.textContent });

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
