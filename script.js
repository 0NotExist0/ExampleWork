/**
 * Gestore principale dell'invio (Metodo Completo - Parser Riparato e Anti-Lag)
 */
async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    let msgDiv = null;
    let isStreamActive = true; 

    try {
        if (!window.CONFIG || !window.CONFIG.API_KEY) {
            throw new Error("Dati di configurazione mancanti. Verifica API_KEY e MODEL.");
        }

        console.log(`📡 Contattando OpenRouter per il modello: ${window.CONFIG.MODEL}...`);

        const requestBody = {
            model: window.CONFIG.MODEL,
            messages: chatHistory,
            stream: true,
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
            throw new Error(errorData.error?.message || `Errore HTTP ${response.status}`);
        }

        msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'ai');
        
        const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
        if (liveReasoning) msgDiv.appendChild(liveReasoning.container);
        
        const textNode = document.createElement('div');
        textNode.style.whiteSpace = "pre-wrap"; 
        textNode.style.fontFamily = "inherit";
        textNode.style.wordBreak = "break-word"; // Evita che righe di codice troppo lunghe rompano l'UI
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

        // --- MOTORE DI RENDERING ANTI-LAG ---
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

        // --- LETTURA STREAM LINEARE ---
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // RIPRISTINATA la logica sicura del \n per prevenire caricamenti infiniti
            let lines = buffer.split('\n');
            buffer = lines.pop(); 

            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith(':')) continue;

                if (line.includes('"error"')) {
                    throw new Error("Il server ha segnalato un errore nel flusso di rete.");
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
                        
                        // Chiama l'aggiornamento UI senza congelare il thread
                        requestRender();
                        
                    } catch (e) {
                        // Salta il pacchetto rotto senza fare crashare la chat
                    }
                }
            }
        }

        // --- PULIZIA FINALE ---
        isStreamActive = false;
        let finalContent = displayContent.trim();
        textNode.textContent = finalContent;
        messageArea.scrollTop = messageArea.scrollHeight;

        if (liveReasoning) {
            const hasReasoning = (nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
            liveReasoning.finish(hasReasoning);
        }

        if (!receivedValidData || (finalContent === "" && displayReasoning === "")) {
            throw new Error("Nessun dato valido ricevuto (risposta vuota).");
        } else {
            chatHistory.push({ role: 'assistant', content: finalContent });
        }

    } catch (error) {
        console.error('❌ Eccezione fatale nel loop di rete:', error);
        isStreamActive = false;
        
        if (msgDiv && msgDiv.parentNode) {
            if (msgDiv.textContent === "▮" || msgDiv.textContent === "") {
                messageArea.removeChild(msgDiv);
            } else {
                const errorAlert = document.createElement('div');
                errorAlert.style.cssText = "color: #ef4444; font-size: 14px; margin-top: 10px; font-weight: bold;";
                errorAlert.textContent = `[Rete Disconnessa: ${error.message}]`;
                msgDiv.appendChild(errorAlert);
            }
        } else {
            appendUserMessage(`Errore di sistema: ${error.message}`, 'ai');
        }
        
        chatHistory.pop();
    } finally {
        toggleLoading(false);
    }
}
