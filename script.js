/**
 * Modulo Chat Principale (Core Logic: Gestione Testo Streaming + Generazione Immagini)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js caricato correttamente (Supporto Immagini attivo).");

// Inizializzazione UI
if (!sendBtn || !userInput || !messageArea) {
    console.error("❌ Errore critico: Elementi UI non trovati nel file HTML! Controlla gli ID.");
} else {
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    userInput.focus();
    console.log("✅ Event listeners collegati con successo.");
}

/**
 * Utility grafica per aggiungere messaggi dell'utente
 */
function appendUserMessage(content, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

/**
 * Utility per bloccare/sbloccare l'input durante il caricamento
 */
function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) {
        userInput.focus();
    }
}

/**
 * Gestore principale dell'invio messaggi
 */
async function handleSendMessage() {
    console.log("▶️ Tentativo di invio messaggio...");
    
    if (sendBtn.disabled) return;

    const text = userInput.value.trim();
    if (!text) return;

    // Aggiungi messaggio utente e pulisci input
    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    // Preparazione area messaggio IA (vuota con indicatore di caricamento)
    let msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    
    // Contenitore per il testo o l'immagine finale
    const contentNode = document.createElement('div');
    contentNode.style.whiteSpace = "pre-wrap"; 
    contentNode.style.wordBreak = "break-word"; 
    contentNode.textContent = "⌛ Elaborazione..."; // Placeholder iniziale
    msgDiv.appendChild(contentNode);
    
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;

    // Recupero configurazione
    if (typeof window.CONFIG === 'undefined') {
        contentNode.textContent = "❌ Errore: CONFIG non definito.";
        toggleLoading(false);
        return;
    }

    const provider = window.CONFIG.PROVIDER || 'openrouter';
    const activeToken = window.CONFIG._activeKey || window.CONFIG.API_KEY;
    const model = window.CONFIG.MODEL;

    if (!activeToken) {
        contentNode.textContent = "⚠️ Chiave API mancante nelle impostazioni (⚙️).";
        toggleLoading(false);
        return;
    }

    console.log(`📡 Provider: ${provider} | Modello: ${model}`);

    try {
        // =====================================================================
        // RAMO A: GENERAZIONE IMMAGINI (Hugging Face)
        // =====================================================================
        if (provider === 'huggingface') {
            console.log("🎨 Richiesta generazione immagine a Hugging Face...");
            contentNode.textContent = "🎨 Generazione immagine in corso (potrebbe volerci un minuto)...▮";

            // Corpo richiesta semplificato per HF Inference API Immagini
            const hfRequestBody = { 
                inputs: text,
                parameters: {
                    // Opzionale: puoi aggiungere parametri specifici qui se supportati dal modello
                    // es: negative_prompt: "low quality, ugly"
                }
            };

            const response = await fetch(window.CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`
                },
                body: JSON.stringify(hfRequestBody)
            });

            if (!response.ok) {
                // HF a volte risponde in JSON anche per errori di immagini
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Errore HTTP ${response.status} da HF.`);
            }

            // --- TRATTAMENTO RISULTATO BINARIO (BLOB) ---
            console.log("✅ Immagine ricevuta, conversione in formato visualizzabile...");
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob); // Crea un URL temporaneo nel browser

            // Aggiorna la UI sostituendo il testo con l'immagine
            contentNode.textContent = ""; // Rimuovi placeholder
            const imgEl = document.createElement('img');
            imgEl.src = imageUrl;
            imgEl.alt = `Immagine generata per: ${text}`;
            imgEl.style.maxWidth = '100%';
            imgEl.style.borderRadius = '8px';
            imgEl.style.marginTop = '10px';
            imgEl.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            
            // Quando l'immagine è caricata fisicamente, scorri verso il basso
            imgEl.onload = () => messageArea.scrollTop = messageArea.scrollHeight;
            
            contentNode.appendChild(imgEl);

            // Salviamo nella history un riferimento testuale
            chatHistory.push({ role: 'assistant', content: `[Immagine Generata: ${text}]` });
            console.log("✅ Immagine visualizzata con successo.");

        } 
        // =====================================================================
        // RAMO B: CHAT TESTUALE STREAMING (OpenRouter / Standard)
        // =====================================================================
        else {
            console.log("✍️ Richiesta chat testuale streaming a OpenRouter...");
            contentNode.textContent = "▮"; // Placeholder streaming

            // Recupero blocco reasoning se attivo (plugin esterno)
            const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
            if (liveReasoning) msgDiv.insertBefore(liveReasoning.container, contentNode);

            const requestBody = {
                model: model,
                messages: chatHistory,
                stream: true,
                include_reasoning: true
            };

            const response = await fetch(window.CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'NemoAdam Cloud UI'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Errore HTTP ${response.status}`);
            }

            // --- LOGICA LETTURA STREAMING (Invariata ma isolata) ---
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let nativeReasoningBuffer = "";
            let rawContentBuffer = "";
            let displayContent = "";
            let displayReasoning = "";
            let isStreamActive = true;

            // Motore di Rendering Anti-Lag
            let renderRequested = false;
            const updateUI = () => {
                if (!isStreamActive) return;
                // Aggiorna reasoning
                if (liveReasoning && displayReasoning) liveReasoning.updateText(displayReasoning);
                // Aggiorna testo principale
                contentNode.textContent = displayContent.trimStart() + " ▮";
                messageArea.scrollTop = messageArea.scrollHeight;
                renderRequested = false;
            };

            const requestRender = () => {
                if (!renderRequested) {
                    renderRequested = true;
                    requestAnimationFrame(updateUI);
                }
            };

            // Ciclo di lettura dello stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n');
                buffer = lines.pop(); 

                for (let line of lines) {
                    line = line.trim();
                    if (!line || !line.startsWith('data: ')) continue;
                    const dataStr = line.substring(6).trim();
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        const delta = dataObj.choices?.[0]?.delta;
                        if (!delta) continue;

                        if (delta.reasoning_content) nativeReasoningBuffer += delta.reasoning_content;
                        if (delta.content)           rawContentBuffer += delta.content;

                        // Gestione tag <think> inline
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
                        }

                        displayReasoning = [nativeReasoningBuffer, displayReasoning].filter(Boolean).join("\n").trim();
                        requestRender();
                        
                    } catch (e) {}
                }
            }

            // Finalizzazione stream testo
            isStreamActive = false;
            let finalContent = displayContent.trim();
            contentNode.textContent = finalContent; // Rimuovi cursore ▮
            messageArea.scrollTop = messageArea.scrollHeight;

            if (liveReasoning) {
                const hasReasoning = (nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
                liveReasoning.finish(hasReasoning);
            }

            if (finalContent === "" && displayReasoning === "") {
                throw new Error("Il server non ha inviato nessuna risposta valida.");
            } else {
                chatHistory.push({ role: 'assistant', content: finalContent });
            }
        }

    } catch (error) {
        console.error('❌ ERRORE CRITICO:', error);
        
        // Pulizia UI in caso di errore
        if (contentNode.textContent === "⌛ Elaborazione..." || contentNode.textContent === "▮" || contentNode.textContent.includes("Generazione immagine")) {
             contentNode.textContent = `❌ Errore di sistema: ${error.message}`;
             contentNode.style.color = "#ef4444";
        } else {
            // Se c'era già del testo parziale, aggiungi l'errore sotto
            const errorAlert = document.createElement('div');
            errorAlert.style.cssText = "color: #ef4444; font-size: 14px; margin-top: 10px; font-weight: bold;";
            errorAlert.textContent = `[Errore interruzione: ${error.message}]`;
            msgDiv.appendChild(errorAlert);
        }
        
        // Rimuovi l'ultimo messaggio utente dalla history se la richiesta è fallita completamente
        if(chatHistory.length > 0 && chatHistory[chatHistory.length-1].role === 'user') {
             chatHistory.pop();
        }
    } finally {
        toggleLoading(false);
    }
}
