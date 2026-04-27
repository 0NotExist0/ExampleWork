/**
 * Modulo Chat Principale (Core Logic: Stream Blindato e Debugger di Rete)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js avviato con Stream Parser blindato.");

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

    let msgDiv = null;

    try {
        if (!window.CONFIG || !window.CONFIG.API_KEY) {
            throw new Error("Dati di configurazione mancanti.");
        }

        console.log(`📡 Contattando OpenRouter per il modello: ${window.CONFIG.MODEL}...`);

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
                stream: true // Rimosso include_reasoning che fa crashare alcuni modelli free
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Errore HTTP ${response.status}`);
        }

        // ISTANZIAZIONE DEL PREFAB UI
        msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'ai');
        
        const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
        if (liveReasoning) msgDiv.appendChild(liveReasoning.container);
        
        const textNode = document.createElement('div');
        textNode.textContent = "▮"; // Cursore di attesa
        msgDiv.appendChild(textNode);
        
        messageArea.appendChild(msgDiv);
        messageArea.scrollTop = messageArea.scrollHeight;

        // LETTURA DELLO STREAM
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        
        let nativeReasoningBuffer = "";
        let rawContentBuffer = "";
        let receivedValidData = false; // Flag per controllare se il server ci sta ignorando

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Salva l'ultimo pezzo incompleto

            for (let line of lines) {
                line = line.trim();
                
                // Ignora righe vuote e commenti di keep-alive del server
                if (!line || line.startsWith(':')) continue; 

                // Se OpenRouter manda un errore testuale grezzo nello stream
                if (line.includes('"error"')) {
                    console.error("❌ Il server ha inviato un errore nello stream:", line);
                    throw new Error("Errore interno del server durante la generazione.");
                }

                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        const delta = dataObj.choices[0]?.delta;
                        
                        if (!delta) continue;
                        receivedValidData = true; // Abbiamo ricevuto almeno un byte utile!

                        if (delta.reasoning) nativeReasoningBuffer += delta.reasoning;
                        if (delta.content) rawContentBuffer += delta.content;

                        // PARSER SEMPLIFICATO E SICURO
                        let displayContent = "";
                        let displayReasoning = "";

                        let thinkStart = rawContentBuffer.indexOf('<think>');
                        if (thinkStart !== -1) {
                            let thinkEnd = rawContentBuffer.indexOf('</think>', thinkStart);
                            if (thinkEnd !== -1) {
                                displayContent = rawContentBuffer.substring(0, thinkStart) + rawContentBuffer.substring(thinkEnd + 8);
                                displayReasoning = rawContentBuffer.substring(thinkStart + 7, thinkEnd);
                            } else {
                                displayContent = rawContentBuffer.substring(0, thinkStart);
                                displayReasoning = rawContentBuffer.substring(thinkStart + 7);
                            }
                        } else {
                            displayContent = rawContentBuffer;
                        }

                        let finalReasoning = (nativeReasoningBuffer + "\n" + displayReasoning).trim();
                        
                        // Aggiorna UI
                        if (finalReasoning && liveReasoning) {
                            liveReasoning.updateText(finalReasoning);
                        }
                        textNode.textContent = displayContent.trimStart() + " ▮";
                        
                        messageArea.scrollTop = messageArea.scrollHeight;
                        
                    } catch (e) {
                        // Stampiamo il pacchetto corrotto per indagini, ma non blocchiamo l'app
                        console.warn("⚠️ Pacchetto JSON ignorato perché corrotto:", dataStr);
                    }
                }
            }
        }

        // --- FINE STREAM E GARBAGE COLLECTION ---
        let finalContent = textNode.textContent.replace(" ▮", "").replace("▮", "").trim();
        textNode.textContent = finalContent;

        if (liveReasoning) {
            const hasReasoning = (nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
            liveReasoning.finish(hasReasoning);
        }

        // Failsafe: Distruggi il GameObject se non è arrivato nulla
        if (!receivedValidData || (finalContent === "" && nativeReasoningBuffer === "" && !rawContentBuffer.includes('<think>'))) {
            console.warn("🗑️ Ricevuta risposta vuota dal server. Distruggo il Prefab UI.");
            if (msgDiv && msgDiv.parentNode) {
                messageArea.removeChild(msgDiv); 
            }
            appendUserMessage("⚠️ Il server (OpenRouter) è sovraccarico o il modello gratuito è offline in questo momento. Riprova tra poco.", 'ai');
            chatHistory.pop(); 
        } else {
            chatHistory.push({ role: 'assistant', content: finalContent });
        }

    } catch (error) {
        console.error('❌ Eccezione fatale nel loop di rete:', error);
        
        // Se c'è stato un crash, puliamo il fumetto "bloccato"
        if (msgDiv && msgDiv.parentNode && msgDiv.textContent === "▮") {
            messageArea.removeChild(msgDiv);
        }
        
        appendUserMessage(`Errore di sistema: ${error.message}`, 'ai');
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
