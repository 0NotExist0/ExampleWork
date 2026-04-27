/**
 * Modulo Chat Principale (Core Logic: Stream Blindato + Supporto Multimediale Fal.ai)
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
            e.preventDefault();
            handleSendMessage();
        }
    });
    userInput.focus();
    console.log("✅ Event listeners collegati con successo.");
}

function isReasoningModel(modelId) {
    if (!modelId) return false;
    const id = modelId.toLowerCase();
    return id.includes('r1') || id.includes('reasoning') || id.includes('think');
}

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
    if (!isLoading) {
        userInput.focus();
    }
}

/**
 * Gestore principale dell'invio con Bivio (OpenRouter vs Fal.ai)
 */
async function handleSendMessage() {
    console.log("▶️ Tentativo di invio messaggio...");
    
    if (sendBtn.disabled) return;

    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    let msgDiv = null;
    let isStreamActive = true; 

    try {
        if (typeof window.CONFIG === 'undefined') throw new Error("window.CONFIG non è definito.");
        if (!window.CONFIG.MODEL) throw new Error("MODEL mancante nella configurazione.");

        // ════════════════════════════════════════════════════════════════════
        // 🚀 BIVIO 1: MOTORE MULTIMEDIALE FAL.AI (Generazione Immagini e Video)
        // ════════════════════════════════════════════════════════════════════
        if (window.CONFIG.PROVIDER === 'fal') {
            if (!window.CONFIG.FAL_KEY) throw new Error("Chiave API di Fal.ai mancante.");
            
            console.log(`🎨 Contattando Fal.ai per il modello: ${window.CONFIG.MODEL}...`);

            msgDiv = document.createElement('div');
            msgDiv.classList.add('message', 'ai');
            
            // UI di Attesa (Fal.ai non ha streaming, dobbiamo aspettare che l'immagine sia pronta)
            const loadingText = document.createElement('div');
            loadingText.innerHTML = "⏳ <i>Generazione in corso... (la creazione di video può richiedere fino a 1 minuto)</i>";
            loadingText.style.color = "#9ca3af";
            msgDiv.appendChild(loadingText);
            messageArea.appendChild(msgDiv);
            messageArea.scrollTop = messageArea.scrollHeight;

            const response = await fetch(`https://fal.run/${window.CONFIG.MODEL}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${window.CONFIG.FAL_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: text })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `Errore HTTP Fal.ai: ${response.status}`);
            }

            const data = await response.json();
            msgDiv.innerHTML = ''; // Rimuoviamo il testo di attesa
            
            let mediaUrl = null;
            let isVideo = false;

            // Fal.ai ha formati di risposta diversi a seconda se è foto o video, li intercettiamo tutti
            if (data.images && data.images.length > 0) {
                mediaUrl = data.images[0].url;
            } else if (data.video && data.video.url) {
                mediaUrl = data.video.url;
                isVideo = true;
            } else if (data.url) {
                mediaUrl = data.url;
                isVideo = mediaUrl.endsWith('.mp4');
            }

            // Mostriamo il file multimediale a schermo
            if (mediaUrl) {
                if (isVideo) {
                    const vidEl = document.createElement('video');
                    vidEl.src = mediaUrl;
                    vidEl.controls = true;
                    vidEl.autoplay = true;
                    vidEl.loop = true;
                    vidEl.style.maxWidth = '100%';
                    vidEl.style.borderRadius = '8px';
                    msgDiv.appendChild(vidEl);
                } else {
                    const imgEl = document.createElement('img');
                    imgEl.src = mediaUrl;
                    imgEl.style.maxWidth = '100%';
                    imgEl.style.borderRadius = '8px';
                    // Effetto per aprire l'immagine in grande se cliccata
                    imgEl.onclick = () => window.open(mediaUrl, '_blank'); 
                    imgEl.style.cursor = 'pointer';
                    msgDiv.appendChild(imgEl);
                }
                chatHistory.push({ role: 'assistant', content: `[Media generato con successo: ${mediaUrl}]` });
                console.log("✅ Fal.ai: Generazione multimediale completata.");
            } else {
                msgDiv.textContent = "Il modello ha completato il lavoro, ma non è stato possibile estrarre l'URL del file.";
                console.warn("Dati grezzi Fal.ai:", data);
            }

            messageArea.scrollTop = messageArea.scrollHeight;
            toggleLoading(false);
            return; // 🛑 INTERROMPE L'ESECUZIONE QUI (Non prosegue verso OpenRouter)
        }

        // ════════════════════════════════════════════════════════════════════
        // 💬 BIVIO 2: MOTORE TESTUALE OPENROUTER (Chat Streaming)
        // ════════════════════════════════════════════════════════════════════
        
        if (!window.CONFIG.API_KEY) throw new Error("API_KEY OpenRouter mancante.");
        console.log(`📡 Contattando OpenRouter per il modello: ${window.CONFIG.MODEL}...`);

        const requestBody = {
            model: window.CONFIG.MODEL,
            messages: chatHistory,
            stream: true,
            include_reasoning: true
        };

        const response = await fetch(window.CONFIG.API_URL || 'https://openrouter.ai/api/v1/chat/completions', {
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); 

            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith(':')) continue;
                if (line.includes('"error"')) throw new Error("Il server ha inviato un errore JSON all'interno del flusso.");

                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        const delta = dataObj.choices?.[0]?.delta;

                        if (!delta) continue;
                        receivedValidData = true;

                        if (delta.reasoning)         nativeReasoningBuffer += delta.reasoning;
                        if (delta.reasoning_content) nativeReasoningBuffer += delta.reasoning_content;
                        if (delta.content)           rawContentBuffer += delta.content;

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
                        // Salta i chunk illeggibili
                    }
                }
            }
        }

        if (liveReasoning && displayReasoning) {
            liveReasoning.updateText(displayReasoning);
        }

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
        }

    } catch (error) {
        console.error('❌ ERRORE CRITICO:', error.message);
        isStreamActive = false;
        
        if (msgDiv && msgDiv.parentNode) {
            if (msgDiv.textContent === "▮" || msgDiv.textContent === "" || msgDiv.textContent.includes("Generazione in corso")) {
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
        
        chatHistory.pop();
    } finally {
        toggleLoading(false);
    }
}
