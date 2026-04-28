/**
 * Modulo Chat Principale (Core Logic: Gestione Testo Streaming + Generazione Immagini)
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js caricato correttamente (Supporto Immagini attivo via Proxy).");

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

async function handleSendMessage() {
    console.log("▶️ Tentativo di invio messaggio...");
    if (sendBtn.disabled) return;

    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    toggleLoading(true);

    // Area messaggio IA
    let msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    const contentNode = document.createElement('div');
    contentNode.style.whiteSpace = "pre-wrap";
    contentNode.style.wordBreak = "break-word";
    contentNode.textContent = "⌛ Elaborazione...";
    msgDiv.appendChild(contentNode);
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;

    if (typeof window.CONFIG === 'undefined') {
        contentNode.textContent = "❌ Errore: CONFIG non definito.";
        toggleLoading(false);
        return;
    }

    const provider = window.CONFIG.PROVIDER || 'openrouter';
    const activeToken = window.CONFIG._activeKey || window.CONFIG.API_KEY;
    const model = window.CONFIG.MODEL;

    // Controllo token: NON richiesto lato client se usiamo il proxy per HuggingFace
    if (!activeToken && provider !== 'huggingface') {
        contentNode.textContent = "⚠️ Chiave API testuale mancante nelle impostazioni (⚙️).";
        toggleLoading(false);
        return;
    }

    console.log(`📡 Provider: ${provider} | Modello: ${model}`);

    try {
        // =====================================================================
        // RAMO A: GENERAZIONE IMMAGINI (HuggingFace via Proxy Vercel locale)
        // =====================================================================
        if (provider === 'huggingface') {
            console.log("🎨 Richiesta generazione immagine tramite proxy locale /api/hf-proxy...");
            contentNode.textContent = "🎨 Generazione immagine in corso (potrebbe volerci un minuto)...▮";

            const hfRequestBody = { inputs: text };

            // ⚠️ Chiamiamo forzatamente l'endpoint del proxy locale!
            const response = await fetch('/api/hf-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hfRequestBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                let errMsg = `Errore HTTP ${response.status}`;
                try {
                    const errJson = JSON.parse(errText);
                    errMsg = errJson.error || errMsg;
                } catch (_) { errMsg = errText || errMsg; }
                throw new Error(errMsg);
            }

            const contentType = response.headers.get('content-type') || '';
            console.log("📦 Content-Type ricevuto:", contentType);

            if (contentType.includes('application/json')) {
                const json = await response.json();
                console.log("📦 Risposta JSON HF:", json);

                const imgSrc = json?.[0]?.url || json?.[0]?.image || json?.url || json?.image;
                if (imgSrc) {
                    renderImage(imgSrc, text, contentNode);
                } else {
                    contentNode.textContent = "⚠️ Risposta non riconosciuta: " + JSON.stringify(json).substring(0, 200);
                }
            } else {
                console.log("✅ Immagine binaria ricevuta, conversione in blob...");
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                renderImage(imageUrl, text, contentNode);
            }

            chatHistory.push({ role: 'assistant', content: `[Immagine Generata: ${text}]` });
            console.log("✅ Immagine visualizzata con successo.");
        }

        // =====================================================================
        // RAMO B: CHAT TESTUALE STREAMING (OpenRouter / Standard)
        // =====================================================================
        else {
            console.log("✍️ Richiesta chat testuale streaming...");
            contentNode.textContent = "▮";

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

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let nativeReasoningBuffer = "";
            let rawContentBuffer = "";
            let displayContent = "";
            let displayReasoning = "";
            let isStreamActive = true;

            let renderRequested = false;
            const updateUI = () => {
                if (!isStreamActive) return;
                if (liveReasoning && displayReasoning) liveReasoning.updateText(displayReasoning);
                contentNode.textContent = displayContent.trimStart() + " ▮";
                messageArea.scrollTop = messageArea.scrollHeight;
                renderRequested = false;
            };
            const requestRender = () => {
                if (!renderRequested) { renderRequested = true; requestAnimationFrame(updateUI); }
            };

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
                        }
                        displayReasoning = [nativeReasoningBuffer, displayReasoning].filter(Boolean).join("\n").trim();
                        requestRender();
                    } catch (e) {}
                }
            }

            isStreamActive = false;
            let finalContent = displayContent.trim();
            contentNode.textContent = finalContent;
            messageArea.scrollTop = messageArea.scrollHeight;

            if (liveReasoning) {
                liveReasoning.finish(nativeReasoningBuffer.length > 0 || rawContentBuffer.includes('<think>'));
            }

            if (finalContent === "" && displayReasoning === "") {
                throw new Error("Il server non ha inviato nessuna risposta valida.");
            } else {
                chatHistory.push({ role: 'assistant', content: finalContent });
            }
        }

    } catch (error) {
        console.error('❌ ERRORE CRITICO:', error);
        const wasEmpty = ["⌛ Elaborazione...", "▮"].some(s => contentNode.textContent === s)
            || contentNode.textContent.includes("Generazione immagine");

        if (wasEmpty) {
            contentNode.textContent = `❌ Errore di sistema: ${error.message}`;
            contentNode.style.color = "#ef4444";
        } else {
            const errorAlert = document.createElement('div');
            errorAlert.style.cssText = "color: #ef4444; font-size: 14px; margin-top: 10px; font-weight: bold;";
            errorAlert.textContent = `[Errore interruzione: ${error.message}]`;
            msgDiv.appendChild(errorAlert);
        }
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            chatHistory.pop();
        }
    } finally {
        toggleLoading(false);
    }
}

// ── Helper: mostra immagine nel chat ──────────────────────────────────────────
function renderImage(src, prompt, container) {
    container.textContent = "";
    const imgEl = document.createElement('img');
    imgEl.src = src;
    imgEl.alt = `Immagine generata: ${prompt}`;
    imgEl.style.cssText = "max-width:100%;border-radius:8px;margin-top:10px;box-shadow:0 4px 6px rgba(0,0,0,0.3);";
    imgEl.onload = () => messageArea.scrollTop = messageArea.scrollHeight;
    imgEl.onerror = () => { container.textContent = "⚠️ Immagine ricevuta ma non visualizzabile. Src: " + src.substring(0, 80); };
    container.appendChild(imgEl);
}
