/**
 * Model Selector Avanzato — Integrato con Scansione Dinamica HF e Controllo Stato Reale
 */

if (!window.__modelSelectorLoaded) {
    window.__modelSelectorLoaded = true;

    // Modelli fissi che vogliamo sempre mostrare
    const FIXED_HF_MODELS = [
        { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell" },
        { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL Base" }
    ];

    async function initModelSelector() {
        const header = document.querySelector('header');
        if (!header || document.getElementById('model-menu-root')) return;

        // Iniezione Stili (Tier Badge dinamici basati sullo stato reale del server)
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .hf-badge-loading { font-size: 9px; background: #374151; color: #9ca3af; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
            .hf-badge-online { font-size: 9px; background: #065f46; color: #6ee7b7; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
            .hf-badge-standby { font-size: 9px; background: #92400e; color: #fcd34d; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
            .hf-badge-pro { font-size: 9px; background: #7f1d1d; color: #fca5a5; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
            .hf-badge-error { font-size: 9px; background: #000000; color: #ef4444; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
            .tier-header { padding: 4px 12px; font-size: 10px; color: #9ca3af; font-weight: bold; text-transform: uppercase; border-top: 1px solid #374151; margin-top: 5px; }
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

        // --- SISTEMA DI CODA ASINCRONA ---
        // Architettura a worker per limitare la concorrenza di rete verso HF
        class StatusQueue {
            constructor(concurrency = 4) {
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
                    // Controlliamo lo stato reale dal server di HF
                    const res = await fetch(`https://api-inference.huggingface.co/status/${task.modelId}`);
                    
                    if (res.status === 404 || res.status === 401) {
                        this.updateUI(task.badgeElement, 'pro', 'PRO / NON DISP.');
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
                    this.updateUI(task.badgeElement, 'error', 'OFFLINE');
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

        // Istanziamo la coda con un limite di 4 thread paralleli
        const hfStatusQueue = new StatusQueue(4);

        // ─── CARICAMENTO DATI ───
        try {
            const orRes = await fetch('https://openrouter.ai/api/v1/models');
            const orData = await orRes.json();
            allOpenRouterModels = orData.data;

            const hfRes = await fetch('https://huggingface.co/api/models?pipeline_tag=text-to-image&sort=downloads&direction=-1&limit=50&filter=inference');
            dynamicHfModels = await hfRes.json();
            
            renderAll();
        } catch (e) {
            console.error("Errore caricamento modelli:", e);
        }

        function renderAll() {
            mainSubmenu.innerHTML = '';
            
            const searchWrap = document.createElement('div');
            searchWrap.style.padding = '8px';
            searchWrap.innerHTML = `<input type="text" id="model-search" placeholder="🔍 Cerca nel cloud..." style="width:100%; padding:6px; background:#1f2937; color:white; border:1px solid #4b5563; border-radius:4px;">`;
            mainSubmenu.appendChild(searchWrap);
            
            const listCont = document.createElement('div');
            mainSubmenu.appendChild(listCont);

            const favDir = createFolder("⭐ Preferiti", listCont);
            const favSub = createSubmenu(listCont);
            renderFavorites(favSub);

            const orDir = createFolder("🔀 OpenRouter", listCont);
            const orSub = createSubmenu(listCont);
            allOpenRouterModels.forEach(m => createLeaf(m, 'openrouter', orSub, () => renderFavorites(favSub)));

            const hfDir = createFolder("🤗 HuggingFace (Reale)", listCont);
            const hfSub = createSubmenu(listCont);
            
            const combinedHf = [...FIXED_HF_MODELS];
            dynamicHfModels.forEach(m => {
                if(!combinedHf.find(x => x.id === m.id)) combinedHf.push({ id: m.id, name: m.id.split('/')[1] });
            });

            combinedHf.forEach(m => createLeaf(m, 'huggingface', hfSub, () => renderFavorites(favSub)));
        }

        // ─── HELPER UI ───
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
            
            // Applichiamo un badge di caricamento iniziale solo per HF
            const badgeHtml = provider === 'huggingface' 
                ? `<span class="badge-container hf-badge-loading">VERIFICA...</span>` 
                : '';
            
            div.innerHTML = `
                <span class="name" title="${model.id}">${model.name || model.id}${badgeHtml}</span>
                <span class="fav ${isFav ? 'active' : ''}">★</span>
            `;

            // Spediamo il riferimento al nodo HTML alla nostra coda asincrona
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
                renderFavorites(document.querySelector('.folder-fav + .submenu')); 
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
            const status = document.querySelector('.status-indicator');
            if (status) status.innerHTML = `Online - <span style="color:#60a5fa">${id.split('/').pop()}</span>`;
            
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
                createLeaf({id, name: id.split('/').pop()}, 'huggingface', container, () => renderFavorites(container));
            });
        }
    }

    initModelSelector();
}
