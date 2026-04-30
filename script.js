/**
 * NEMOADAM CLOUD UI - Core Logic Completa
 * Gestione Text Streaming, Image Proxy, Catalogo Dinamico (con Massive Fallback) e Stato Real-Time
 */

let chatHistory = [];

// Elementi UI Chat
const messageArea = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

console.log("⚙️ script.js caricato. Inizializzazione sistema globale...");

// ─── INIZIALIZZAZIONE CHAT ───────────────────────────────────────────────────

if (!sendBtn || !userInput || !messageArea) {
    console.error("❌ Errore: Elementi UI critici della chat mancanti.");
} else {
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    userInput.focus();
}

// ─── GESTORE CODE DI STATO (WORKER ASINCRONO) ────────────────────────────────

class StatusQueue {
    constructor(concurrency = 3) {
        this.queue = [];
        this.active = 0;
        this.concurrency = concurrency;
    }

    add(modelId, badgeElement) {
        this.queue.push({ modelId, badgeElement });
        this.processNext();
    }

    async processNext() {
        if (this.active >= this.concurrency || this.queue.length === 0) return;
        
        this.active++;
        const task = this.queue.shift();
        
        try {
            const token = window.CONFIG?._activeKey || window.CONFIG?.API_KEY || '';
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            const res = await fetch(`https://api-inference.huggingface.co/status/${task.modelId}`, { headers });
            
            if (res.status === 404) {
                this.updateUI(task.badgeElement, 'pro', 'NON DISP.');
            } else if (res.status === 401 || res.status === 403) {
                this.updateUI(task.badgeElement, 'pro', 'TOKEN RICHIESTO');
            } else if (res.status === 429) {
                this.updateUI(task.badgeElement, 'error', 'RATE LIMIT');
            } else {
                const data = await res.json();
                if (data.error && data.error.toLowerCase().includes("pro")) {
                    this.updateUI(task.badgeElement, 'pro', 'SOLO PRO');
                } else if (data.loaded) {
                    this.updateUI(task.badgeElement, 'online', 'ONLINE');
                } else if (data.state === "Loadable") {
                    this.updateUI(task.badgeElement, 'standby', 'IN STANDBY');
                } else {
                    this.updateUI(task.badgeElement, 'error', 'ERRORE SERVER');
                }
            }
        } catch (e) {
            this.updateUI(task.badgeElement, 'error', 'CORS/OFFLINE');
        }
        
        this.active--;
        this.processNext();
    }

    updateUI(el, statusClass, text) {
        if(!el) return;
        el.className = `badge-container hf-badge-${statusClass}`;
        el.textContent = text;
    }
}

const hfStatusQueue = new StatusQueue(3); 

// ─── COSTRUZIONE MENU MODELLI (CON FALLBACK MASSICCIO) ───────────────────────

// Se il fetch fallisce a causa del blocco CORS, usiamo questa lista hardcoded
const FALLBACK_HF_MODELS = [
    { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell" },
    { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL Base" },
    { id: "stabilityai/sdxl-turbo", name: "SDXL Turbo" },
    { id: "ByteDance/SDXL-Lightning", name: "SDXL Lightning" },
    { id: "runwayml/stable-diffusion-v1-5", name: "Stable Diffusion v1.5" },
    { id: "prompthero/openjourney", name: "Openjourney" },
    { id: "SG161222/RealVisXL_V4.0", name: "RealVisXL V4.0" },
    { id: "cagliostrolab/animagine-xl-3.1", name: "Animagine XL 3.1" },
    { id: "Lykon/dreamshaper-xl", name: "DreamShaper XL" },
    { id: "stabilityai/stable-diffusion-2-1", name: "Stable Diffusion 2.1" },
    { id: "KBlueLeaf/kohaku-v2.1", name: "Kohaku v2.1" },
    { id: "linaqruf/anything-v3.0", name: "Anything v3.0" },
    { id: "stablediffusionapi/edge-of-realism", name: "Edge of Realism" },
    { id: "wavymulder/Analog-Diffusion", name: "Analog Diffusion" },
    { id: "dallinmackay/Van-Gogh-diffusion", name: "Van Gogh Style" },
    { id: "hakurei/waifu-diffusion", name: "Waifu Diffusion" },
    { id: "johnslegers/epic-diffusion", name: "Epic Diffusion" },
    { id: "nitrosocke/Ghibli-Diffusion", name: "Ghibli Style" },
    { id: "proximasanfinis/pokemon-lora", name: "Pokemon LoRA Base" },
    { id: "nerijs/pixel-art-xl", name: "Pixel Art XL" }
];

async function initModelSelector() {
    const header = document.querySelector('header');
    if (!header || document.getElementById('model-menu-root')) return;

    const styleTag = document.createElement('style');
    styleTag.textContent = `
        .hf-badge-loading { font-size: 9px; background: #374151; color: #9ca3af; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
        .hf-badge-online { font-size: 9px; background: #065f46; color: #6ee7b7; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
        .hf-badge-standby { font-size: 9px; background: #92400e; color: #fcd34d; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
        .hf-badge-pro { font-size: 9px; background: #7f1d1d; color: #fca5a5; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
        .hf-badge-error { font-size: 9px; background: #000000; color: #ef4444; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; border: 1px solid #ef4444;}
    `;
    document.head.appendChild(styleTag);

    const rootContainer = document.createElement('div');
    rootContainer.id = 'model-menu-root';
    rootContainer.innerHTML = `
        <div class="menu-item" id="main-trigger">
            <span>📂 <b>Catalogo & Preferiti</b></span>
            <span id="active-model-name" style="color:#60a5fa;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;">Caricamento...</span>
            <span class="arrow">▶</span>
        </div>
        <div class="submenu" id="main-submenu"></div>
    `;
    header.parentNode.insertBefore(rootContainer, header.nextSibling);

    const mainTrigger = rootContainer.querySelector('#main-trigger');
    const mainSubmenu = rootContainer.querySelector('#main-submenu');

    mainTrigger.onclick = () => mainTrigger.classList.toggle('open');

    let allOpenRouterModels = [];
    let dynamicHfModels = [];
    let favoriteIds = JSON.parse(localStorage.getItem('nemotron_favorites')) || [];

    try {
        // Fetch OpenRouter (Se fallisce non blocca il resto)
        const orRes = await fetch('https://openrouter.ai/api/v1/models').catch(() => null);
        if (orRes && orRes.ok) {
            const orData = await orRes.json();
            allOpenRouterModels = orData.data;
        }

        // Fetch HuggingFace 50 Modelli
        console.log("Tentativo di scaricare i 50 modelli da Hugging Face...");
        const hfRes = await fetch('https://huggingface.co/api/models?pipeline_tag=text-to-image&sort=downloads&direction=-1&limit=50').catch(() => null);
        
        if (hfRes && hfRes.ok) {
            dynamicHfModels = await hfRes.json();
            console.log(`✅ Trovati ${dynamicHfModels.length} modelli live da HF!`);
        } else {
            console.warn("⚠️ API HF bloccata (CORS/Rete). Attivazione Fallback Massiccio.");
        }
    } catch (e) {
        console.error("❌ Eccezione durante il caricamento modelli:", e);
    }

    renderAll();

    function renderAll() {
        mainSubmenu.innerHTML = '';
        
        const listCont = document.createElement('div');
        mainSubmenu.appendChild(listCont);

        // 1. Preferiti
        const favDir = createFolder("⭐ Preferiti", listCont);
        const favSub = createSubmenu(listCont);
        renderFavorites(favSub);

        // 2. OpenRouter
        const orDir = createFolder("🔀 OpenRouter", listCont);
        const orSub = createSubmenu(listCont);
        allOpenRouterModels.forEach(m => createLeaf(m, 'openrouter', orSub, () => renderFavorites(favSub)));

        // 3. HuggingFace
        const hfDir = createFolder("🤗 HuggingFace (Reale)", listCont);
        const hfSub = createSubmenu(listCont);
        
        let combinedHf = [];
        
        // Se l'API ha risposto, usiamo i dati live. Altrimenti usiamo il Fallback Massiccio.
        if (Array.isArray(dynamicHfModels) && dynamicHfModels.length > 0) {
            dynamicHfModels.forEach(m => {
                combinedHf.push({ id: m.id, name: m.id.split('/')[1] });
            });
            // Assicuriamoci che Flux e SDXL ci siano sempre
            if(!combinedHf.find(x => x.id === "black-forest-labs/FLUX.1-schnell")) combinedHf.unshift(FALLBACK_HF_MODELS[0]);
            if(!combinedHf.find(x => x.id === "stabilityai/stable-diffusion-xl-base-1.0")) combinedHf.unshift(FALLBACK_HF_MODELS[1]);
        } else {
            // FALLBACK ATTIVO: Carichiamo i 20 modelli sicuri scritti a mano
            combinedHf = [...FALLBACK_HF_MODELS];
        }

        combinedHf.forEach(m => createLeaf(m, 'huggingface', hfSub, () => renderFavorites(favSub)));
    }

    function createFolder(label, parent) {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `<span>${label}</span><span class="arrow">▶</span>`;
        div.onclick = (e) => { e.stopPropagation(); div.classList.toggle('open'); };
        parent.appendChild(div);
        return div;
    }

    function createSubmenu(parent) {
        const div = document.createElement('div');
        div.className = 'submenu';
        parent.appendChild(div);
        return div;
    }

    function createLeaf(model, provider, parent, onFavChange) {
        const div = document.createElement('div');
        div.className = 'menu-item model-leaf';
        const isFav = favoriteIds.includes(model.id);
        
        const badgeHtml = provider === 'huggingface' 
            ? `<span class="badge-container hf-badge-loading">VERIFICA...</span>` 
            : '';
        
        div.innerHTML = `
            <span class="name" title="${model.id}">${model.name || model.id}${badgeHtml}</span>
            <span class="fav ${isFav ? 'active' : ''}">★</span>
        `;

        if (provider === 'huggingface') {
            const badgeEl = div.querySelector('.badge-container');
            hfStatusQueue.add(model.id, badgeEl);
        }

        div.querySelector('.name').onclick = (e) => {
            e.stopPropagation();
            selectModel(model.id, provider);
        };

        div.querySelector('.fav').onclick = (e) => {
            e.stopPropagation();
            toggleFav(model.id);
            if (onFavChange) onFavChange();
            div.querySelector('.fav').classList.toggle('active');
        };

        parent.appendChild(div);
    }

    function selectModel(id, provider) {
        if (!window.CONFIG) return;
        window.CONFIG.MODEL = id;
        window.CONFIG.PROVIDER = provider;

        if (provider === 'huggingface') {
            window.CONFIG.API_URL = '/api/hf-proxy';
        } else {
            window.CONFIG.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
        }

        document.getElementById('active-model-name').innerText = id.split('/').pop();
        console.log(`🎯 Modello attivo: ${id} (${provider})`);
    }

    function toggleFav(id) {
        favoriteIds = favoriteIds.includes(id) ? favoriteIds.filter(f => f !== id) : [...favoriteIds, id];
        localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
    }

    function renderFavorites(container) {
        if (!container) return;
        container.innerHTML = favoriteIds.length ? '' : '<div style="padding:10px; font-style:italic; opacity:0.5;">Nessun preferito</div>';
        favoriteIds.forEach(id => {
            const provider = id.includes('/') && !id.includes('openai') && !id.includes('anthropic') ? 'huggingface' : 'openrouter';
            createLeaf({id, name: id.split('/').pop()}, provider, container, () => renderFavorites(container));
        });
    }
}

// Avvia il menu
initModelSelector();

// ─── GESTIONE INVIO MESSAGGI CHAT ────────────────────────────────────────────

async function handleSendMessage() {
    if (sendBtn.disabled) return;

    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = '';
    chatHistory.push({ role: 'user', content: text });
    toggleLoading(true);

    let msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    const contentNode = document.createElement('div');
    contentNode.style.cssText = "white-space: pre-wrap; word-break: break-word;";
    contentNode.textContent = "⌛ Elaborazione...";
    msgDiv.appendChild(contentNode);
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;

    if (typeof window.CONFIG === 'undefined') {
        contentNode.textContent = "❌ Errore: CONFIG non caricato.";
        toggleLoading(false);
        return;
    }

    const provider = window.CONFIG.PROVIDER || 'openrouter';
    const activeToken = window.CONFIG._activeKey || window.CONFIG.API_KEY;
    const model = window.CONFIG.MODEL;

    try {
        // --- RAMO IMMAGINI (HuggingFace Proxy) ---
        if (provider === 'huggingface') {
            contentNode.textContent = "🎨 Generazione immagine in corso...▮";

            const response = await fetch('/api/hf-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: text, model: model })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Il modello ${model} non è caricato nei server gratis o richiede il Token PRO.`);
                } else if (response.status === 503) {
                    throw new Error(`I server di Hugging Face sono in inizializzazione (503). Riprova.`);
                }
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Errore HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const json = await response.json();
                const imgSrc = json?.[0]?.url || json?.url || json?.image;
                if (imgSrc) renderImage(imgSrc, text, contentNode);
                else throw new Error("Risposta JSON valida ma immagine non trovata.");
            } else {
                const blob = await response.blob();
                renderImage(URL.createObjectURL(blob), text, contentNode);
            }
            chatHistory.push({ role: 'assistant', content: `[Immagine: ${text}]` });
        } 
        
        // --- RAMO TESTO (Streaming OpenRouter) ---
        else {
            contentNode.textContent = "▮";
            
            const response = await fetch(window.CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'NemoAdam Cloud'
                },
                body: JSON.stringify({ model: model, messages: chatHistory, stream: true })
            });

            if (!response.ok) throw new Error(`Errore Server API (${response.status})`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let rawBuffer = "";

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
                            rawBuffer += content;
                            contentNode.textContent = rawBuffer + " ▮";
                            messageArea.scrollTop = messageArea.scrollHeight;
                        } catch (e) {}
                    }
                }
            }
            contentNode.textContent = rawBuffer;
            chatHistory.push({ role: 'assistant', content: rawBuffer });
        }
    } catch (error) {
        console.error("❌ ERRORE:", error);
        contentNode.textContent = `❌ Errore: ${error.message}`;
        contentNode.style.color = "#ef4444";
    } finally {
        toggleLoading(false);
    }
}

// ─── UTILITY FUNZIONI ────────────────────────────────────────────────────────

function appendUserMessage(content, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = content;
    messageArea.appendChild(msgDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function renderImage(src, prompt, container) {
    container.textContent = "";
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = "max-width:100%; border-radius:8px; margin-top:10px; border: 2px solid #00ff88; box-shadow: 0 0 15px rgba(0,255,136,0.2);";
    img.onload = () => messageArea.scrollTop = messageArea.scrollHeight;
    container.appendChild(img);
}

function toggleLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (!isLoading) userInput.focus();
}
