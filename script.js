/**
 * script.js - Logica Chat e Generazione
 */

let chatHistory = [];

const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text || sendBtn.disabled) return;

    // Aggiungi messaggio utente
    appendMessage(text, 'user');
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    
    toggleLoading(true);

    // Area risposta AI
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    const contentNode = document.createElement('div');
    contentNode.style.whiteSpace = "pre-wrap";
    contentNode.textContent = "⌛ Elaborazione...";
    msgDiv.appendChild(contentNode);
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;

    const { PROVIDER, MODEL, API_URL, _activeKey } = window.CONFIG;

    try {
        if (PROVIDER === 'huggingface') {
            // --- RAMO IMMAGINI (Proxy Vercel) ---
            contentNode.textContent = "🎨 Generazione immagine in corso...";
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: text, model: MODEL })
            });

            if (!response.ok) throw new Error(await response.text());

            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);
            
            contentNode.textContent = "";
            const img = document.createElement('img');
            img.src = imgUrl;
            img.style.maxWidth = "100%";
            img.style.borderRadius = "8px";
            img.style.marginTop = "10px";
            contentNode.appendChild(img);
            
            chatHistory.push({ role: 'assistant', content: `[Immagine generata con ${MODEL}]` });

        } else {
            // --- RAMO TESTO (OpenRouter Streaming) ---
            contentNode.textContent = "▮";
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${_activeKey}`,
                },
                body: JSON.stringify({ model: MODEL, messages: chatHistory, stream: true })
            });

            if (!response.ok) throw new Error("Errore API OpenRouter");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (let line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const content = data.choices[0].delta.content || "";
                            fullText += content;
                            contentNode.textContent = fullText + "▮";
                            messageArea.scrollTop = messageArea.scrollHeight;
                        } catch (e) {}
                    }
                }
            }
            contentNode.textContent = fullText;
            chatHistory.push({ role: 'assistant', content: fullText });
        }
    } catch (error) {
        contentNode.textContent = `❌ Errore: ${error.message}`;
        contentNode.style.color = "#ff4444";
    } finally {
        toggleLoading(false);
    }
}

function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('message', sender);
    div.textContent = text;
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function toggleLoading(isLoading) {
    sendBtn.disabled = isLoading;
    userInput.disabled = isLoading;
    if (!isLoading) userInput.focus();
}

// Event Listeners
sendBtn.addEventListener('click', handleSendMessage);
userInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSendMessage(); });
