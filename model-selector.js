/**
 * model_selector.js
 * Responsabilità: Scraping catalogo (OpenRouter + HF), UI del menu, verifica stato server.
 */

if (!window.__modelSelectorLoaded) {
    window.__modelSelectorLoaded = true;

    // Fallback in caso di blocco totale da parte del browser/rete
    const FALLBACK_HF_MODELS = [
        { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell" },
        { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL Base" },
        { id: "stabilityai/sdxl-turbo", name: "SDXL Turbo" },
        { id: "SG161222/RealVisXL_V4.0", name: "RealVisXL V4.0" },
        { id: "runwayml/stable-diffusion-v1-5", name: "Stable Diffusion v1.5" }
    ];

    // Coda asincrona per controllare lo stato senza farsi bloccare da HF (Rate Limit)
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
                this.updateUI(task.badgeElement, 'error', 'OFFLINE/CORS');
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

    async function initModelSelector() {
        const header = document.querySelector('header');
        if (!header || document.getElementById('model-menu-root')) return;

        // CSS per i badge
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

        // Scraping dei modelli all'avvio
        try {
            // OpenRouter (gestito in modo silente se fallisce)
            fetch('https://openrouter.ai/api/v1/models')
                .then(res => res.json())
                .then(data => { allOpenRouterModels = data.data; renderAll(); })
                .catch(() => console.warn("OpenRouter API non raggiungibile"));

            // HuggingFace (Scaricamento massivo dei 50 modelli)
            console.log("Scraping 50 modelli da Hugging Face...");
            const hfRes = await fetch('https://huggingface.co/api/models?pipeline_tag=text-to-image&sort=downloads&direction=-1&limit=50');
            if (hfRes.ok) {
                dynamicHfModels = await hfRes.json();
                console.log(`✅ Scraping completato: ${dynamicHfModels.length} modelli scaricati.`);
            }
        } catch (e) {
            console.error("❌ Errore durante lo scraping di HF. Uso fallback.", e);
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
            
            if (dynamicHfModels && dynamicHfModels.length > 0) {
                dynamicHfModels.forEach(m => {
                    combinedHf.push({ id: m.id, name: m.id.split('/')[1] });
                });
            } else {
                combinedHf = [...FALLBACK_HF_MODELS];
            }

            // Assicuriamoci che Flux e SDXL ci siano sempre in cima
            if(!combinedHf.find(x => x.id === "black-forest-labs/FLUX.1-schnell")) combinedHf.unshift(FALLBACK_HF_MODELS[0]);
            if(!combinedHf.find(x => x.id === "stabilityai/stable-diffusion-xl-base-1.0")) combinedHf.unshift(FALLBACK_HF_MODELS[1]);

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
                hfStatusQueue.add(model.id, badgeEl); // Invia alla coda per il check reale
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
            if (!window.CONFIG) window.CONFIG = {};
            window.CONFIG.MODEL = id;
            window.CONFIG.PROVIDER = provider;

            // Il motore (script.js) leggerà questa API_URL
            if (provider === 'huggingface') {
                window.CONFIG.API_URL = '/api/hf-proxy';
            } else {
                window.CONFIG.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
            }

            document.getElementById('active-model-name').innerText = id.split('/').pop();
            console.log(`🎯 Modello iniettato per il motore: ${id} (${provider})`);
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

    // Inizializza tutto
    initModelSelector();
}
