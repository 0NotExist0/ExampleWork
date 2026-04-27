/**
 * Gestore principale dell'invio (Metodo Completo Ottimizzato)
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

        // ISTANZIAZIONE DEL PREFAB UI
        msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'ai');
        
        const liveReasoning = window.ReasoningUI ? window.ReasoningUI.createLiveReasoningBlock() : null;
        if (liveReasoning) msgDiv.appendChild(liveReasoning.container);
        
        const textNode = document.createElement('div');
        // FIX: Assicura che i ritorni a capo del codice non vengano ignorati dal DOM
        textNode.style.whiteSpace = "pre-wrap"; 
        textNode.style.fontFamily = "inherit";
        textNode.textContent = "▮";
        msgDiv.appendChild(textNode);
        
        messageArea.appendChild(msgDiv);
        messageArea.scrollTop = messageArea.scrollHeight;

        // LETTURA DELLO STREAM
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        
        let nativeReasoningBuffer = "";
        let rawContentBuffer = "";
        let receivedValidData = false;

        // FIX: Throttling per evitare lag dell'interfaccia grafica
        let lastScrollUpdate = Date.now();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });

            // FIX: Parser SSE robusto che non frammenta i pacchetti JSON contenenti codice
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                let line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                
                if (!line || line.startsWith(':')) continue;

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
                        receivedValidData = true;

                        if (delta.reasoning) nativeReasoningBuffer += delta.reasoning;
                        if (delta.content) rawContentBuffer += delta.content;

                        // PARSER SEMPLIFICATO E SICURO per tag <think>
                        let displayContent = "";
                        let displayReasoning = "";

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

                        const finalReasoning = [nativeReasoningBuffer, displayReasoning]
                            .filter(Boolean)
                            .join("\n")
                            .trim();

                        if (finalReasoning) {
                            if (liveReasoning) {
                                liveReasoning.updateText(finalReasoning);
                            } else {
                                let reasoningEl = msgDiv.querySelector('.reasoning-fallback');
                                if (!reasoningEl) {
                                    reasoningEl = document.createElement('div');
                                    reasoningEl.className = 'reasoning-fallback';
                                    reasoningEl.style.cssText = 'color:#9ca3af; font-size:12px; border-left:2px solid #374151; padding-left:8px; margin-bottom:8px; white-space:pre-wrap';
                                    msgDiv.insertBefore(reasoningEl, textNode);
                                }
                                reasoningEl.textContent = `💭 ${finalReasoning}`;
                            }
                        }

                        textNode.textContent = displayContent.trimStart() + " ▮";

                        // Aggiorna lo scroll solo ogni 100ms per non congelare il browser
                        const now = Date.now();
                        if (now - lastScrollUpdate > 100) {
                            messageArea.scrollTop = messageArea.scrollHeight;
                            lastScrollUpdate = now;
                        }
                        
                    } catch (e) {
                        // Ignora silenziosamente solo i frammenti JSON temporaneamente spezzati
                    }
                }
            }
        }

        // --- FINE STREAM E GARBAGE COLLECTION ---
        let finalContent = textNode.textContent.replace(" ▮", "").replace("▮", "").trim();
        textNode.textContent = finalContent;
        messageArea.scrollTop = messageArea.scrollHeight; // Scroll finale garantito

        if (liveReasoning) {
            const hasReasoning = (nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
            liveReasoning.finish(hasReasoning);
        }

        if (!receivedValidData || (finalContent === "" && nativeReasoningBuffer === "" && !rawContentBuffer.includes('<think>'))) {
            throw new Error("Ricevuta risposta vuota dal server.");
        } else {
            chatHistory.push({ role: 'assistant', content: finalContent });
        }

    } catch (error) {
        console.error('❌ Eccezione fatale nel loop di rete:', error);
        
        if (msgDiv && msgDiv.parentNode) {
            if (msgDiv.textContent === "▮") {
                // Se non ha stampato nulla, elimina il blocco
                messageArea.removeChild(msgDiv);
            } else {
                // Se si è interrotto a metà codice, mostra l'errore sotto il testo parziale
                const errorAlert = document.createElement('div');
                errorAlert.style.cssText = "color: #ef4444; font-size: 14px; margin-top: 10px;";
                errorAlert.textContent = `[Rete Disconnessa: ${error.message}]`;
                msgDiv.appendChild(errorAlert);
            }
        } else {
            appendUserMessage(`Errore di sistema: ${error.message}`, 'ai');
        }
        
        // Rimuove l'ultimo messaggio inviato alla history per non corrompere la memoria del modello
        chatHistory.pop();
    } finally {
        toggleLoading(false);
    }
}
