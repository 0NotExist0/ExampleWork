/**
 * Modulo Chat Principale (Core Logic: Stream Blindato, Debugger e Anti-Lag)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js caricato correttamente.");

if (!sendBtn || !userInput || !messageArea) {
    console.error("❌ Errore critico: Elementi UI non trovati nel file HTML! Controlla gli ID.");
} else {
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Evita ritorni a capo accidentali
            handleSendMessage();
        }
    });
    userInput.focus();
    console.log("✅ Event listeners collegati con successo.");
}

/**
 * Determina se un modello supporta il reasoning nativo
 */
function isReasoningModel(modelId) {
    if (!modelId) return false;
    const id = modelId.toLowerCase();
    return id.includes('r1') || id.includes('reasoning') || id.includes('think');
}

/**
 * Utility grafica per aggiungere messaggi
 */
function appendUserMessage(content, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

/**
 * Utility per bloccare/sbloccare l'input
 */
function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) {
        userInput.focus();
    }
}

/**
 * Gestore principale dell'invio (Metodo Completo Definitivo)
 */
async function handleSendMessage() {
    console.log("▶️ Tentativo di invio messaggio...");
    
    if (sendBtn.disabled) {
        console.warn("⚠️ Bottone disabilitato, invio ignorato.");
        return;
    }

    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    let msgDiv = null;
    let isStreamActive = true; 

    try {
        // Controllo di sicurezza rigoroso sulla configurazione
        if (typeof window.CONFIG === 'undefined') throw new Error("window.CONFIG non è definito.");
        if (!window.CONFIG.API_KEY) throw new Error("API_KEY mancante nella configurazione.");
        if (!window.CONFIG.MODEL) throw new Error("MODEL mancante nella configurazione.");

        console.log(`📡 Contattando API per il modello: ${window.CONFIG.MODEL}...`);

        const requestBody = {
            model: window.CONFIG.MODEL,
            messages: chatHistory,
            stream: true,
            include_reasoning: true,
            ...(isReasoningModel(window.CONFIG.MODEL) && { include_reasoning: true })
        };

        const response = await fetch(window.CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.CONFIG.API_KEY}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Nemotron Web UI'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Errore HTTP ${response.status} del server.`);
        }

        console.log("✅ Connessione stabilita, inizio lettura stream...");

        msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'ai');
        
        const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
        if (liveReasoning) msgDiv.appendChild(liveReasoning.container);
        
        const textNode = document.createElement('div');
        textNode.style.whiteSpace = "pre-wrap"; 
        textNode.style.fontFamily = "inherit";
        textNode.style.wordBreak = "break-word"; 
        textNode.textContent = "▮";
        msgDiv.appendChild(textNode);
        
        messageArea.appendChild(msgDiv);
        messageArea.scrollTop = messageArea.scrollHeight;

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        
        let nativeReasoningBuffer = "";
        let rawContentBuffer = "";
        let receivedValidData = false;

        let displayContent = "";
        let displayReasoning = "";

        // Motore di Rendering Anti-Lag (requestAnimationFrame)
        let renderRequested = false;
        const updateUI = () => {
            if (!isStreamActive) return;
            
            if (liveReasoning && displayReasoning) {
                liveReasoning.updateText(displayReasoning);
            } else if (displayReasoning) {
                let reasoningEl = msgDiv.querySelector('.reasoning-fallback');
                if (!reasoningEl) {
                    reasoningEl = document.createElement('div');
                    reasoningEl.className = 'reasoning-fallback';
                    reasoningEl.style.cssText = 'color:#9ca3af; font-size:12px; border-left:2px solid #374151; padding-left:8px; margin-bottom:8px; white-space:pre-wrap';
                    msgDiv.insertBefore(reasoningEl, textNode);
                }
                reasoningEl.textContent = `💭 ${displayReasoning}`;
            }

            textNode.textContent = displayContent.trimStart() + " ▮";
            messageArea.scrollTop = messageArea.scrollHeight;
            renderRequested = false;
        };

        const requestRender = () => {
            if (!renderRequested) {
                renderRequested = true;
                requestAnimationFrame(updateUI);
            }
        };

        // Lettura Stream
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log("⏹️ Stream completato dal server.");
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); 

            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith(':')) continue;

                if (line.includes('"error"')) {
                    throw new Error("Il server ha inviato un errore JSON all'interno del flusso.");
                }

                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        const delta = dataObj.choices?.[0]?.delta;
                        
                        if (!delta) continue;
                        receivedValidData = true;

                        if (delta.reasoning) nativeReasoningBuffer += delta.reasoning;
                        if (delta.reasoning_content) nativeReasoningBuffer += delta.reasoning_content;
                        if (delta.content) rawContentBuffer += delta.content;

                        const thinkStart = rawContentBuffer.indexOf('<think>');
                        if (thinkStart !== -1) {
                            const thinkEnd = rawContentBuffer.indexOf('</think>', thinkStart);
                            if (thinkEnd !== -1) {
                                displayContent = rawContentBuffer.substring(0, thinkStart) + rawContentBuffer.substring(thinkEnd + 8);
                                displayReasoning = rawContentBuffer.substring(thinkStart + 7, thinkEnd);
                            } else {
                                displayContent = rawContentBuffer.substring(0, thinkStart);
                                displayReasoning = rawContentBuffer.substring(thinkStart + 7);
                            }
                        } else {
                            displayContent = rawContentBuffer;
                            displayReasoning = "";
                        }

                        displayReasoning = [nativeReasoningBuffer, displayReasoning].filter(Boolean).join("\n").trim();
                        requestRender();
                        
                    } catch (e) {
                        // Ignora i frammenti spezzati in modo sicuro
                    }
                }
            }
        }

        // Chiusura e salvataggio
        isStreamActive = false;
        let finalContent = displayContent.trim();
        textNode.textContent = finalContent;
        messageArea.scrollTop = messageArea.scrollHeight;

        if (liveReasoning) {
            const hasReasoning = (nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
            liveReasoning.finish(hasReasoning);
        }

        if (!receivedValidData || (finalContent === "" && displayReasoning === "")) {
            throw new Error("Il server ha chiuso la connessione senza inviare testo.");
        } else {
            chatHistory.push({ role: 'assistant', content: finalContent });
            console.log("✅ Risposta IA completata e salvata nella history.");
        }

    } catch (error) {
        console.error('❌ ERRORE CRITICO:', error.message);
        isStreamActive = false;
        
        if (msgDiv && msgDiv.parentNode) {
            if (msgDiv.textContent === "▮" || msgDiv.textContent === "") {
                messageArea.removeChild(msgDiv);
            } else {
                const errorAlert = document.createElement('div');
                errorAlert.style.cssText = "color: #ef4444; font-size: 14px; margin-top: 10px; font-weight: bold;";
                errorAlert.textContent = `[Errore di Rete: ${error.message}]`;
                msgDiv.appendChild(errorAlert);
            }
        } else {
            appendUserMessage(`Errore di sistema: ${error.message}`, 'ai');
        }
        
        chatHistory.pop(); // Rimuove l'ultimo messaggio per evitare di corrompere la memoria
    } finally {
        toggleLoading(false);
    }
}
