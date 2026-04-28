/**
 * Model Selector Avanzato — Integrato con Scansione Dinamica HF
 */

if (!window.__modelSelectorLoaded) {
    window.__modelSelectorLoaded = true;

    // Modelli HF "Sempre Presenti" (Hardcoded)
    const FIXED_HF_MODELS = [
        { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell", tier: 'free' },
        { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL Base", tier: 'free' }
    ];

    async function initModelSelector() {
        const header = document.querySelector('header');
        if (!header || document.getElementById('model-menu-root')) return;

        // Iniezione Stili (Tier Badge)
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .hf-badge-free { font-size: 9px; background: #065f46; color: #6ee7b7; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
            .hf-badge-pro { font-size: 9px; background: #78350f; color: #fcd34d; padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-weight: bold; }
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

        // ─── CARICAMENTO DATI ───
        try {
            // 1. Fetch OpenRouter
            const orRes = await fetch('https://openrouter.ai/api/v1/models');
            const orData = await orRes.json();
            allOpenRouterModels = orData.data;

            // 2. Scansione Dinamica HuggingFace (I migliori 50 gratuiti)
            const hfRes = await fetch('https://huggingface.co/api/models?pipeline_tag=text-to-image&sort=downloads&direction=-1&limit=50&filter=inference');
            dynamicHfModels = await hfRes.json();
            
            renderAll();
        } catch (e) {
            console.error("Errore caricamento modelli:", e);
        }

        function renderAll() {
            mainSubmenu.innerHTML = '';
            
            // Barra di ricerca
            const searchWrap = document.createElement('div');
            searchWrap.style.padding = '8px';
            searchWrap.innerHTML = `<input type="text" id="model-search" placeholder="🔍 Cerca nel cloud..." style="width:100%; padding:6px; background:#1f2937; color:white; border:1px solid #4b5563; border-radius:4px;">`;
            mainSubmenu.appendChild(searchWrap);
            
            const listCont = document.createElement('div');
            mainSubmenu.appendChild(listCont);

            // 1. Cartella Preferiti
            const favDir = createFolder("⭐ Preferiti", listCont);
            const favSub = createSubmenu(listCont);
            renderFavorites(favSub);

            // 2. Cartella OpenRouter
            const orDir = createFolder("🔀 OpenRouter", listCont);
            const orSub = createSubmenu(listCont);
            allOpenRouterModels.forEach(m => createLeaf(m, 'openrouter', null, orSub, () => renderFavorites(favSub)));

            // 3. Cartella HuggingFace (Dinamica)
            const hfDir = createFolder("🤗 HuggingFace (Gratis)", listCont);
            const hfSub = createSubmenu(listCont);
            
            // Uniamo i fissi con i dinamici
            const combinedHf = [...FIXED_HF_MODELS];
            dynamicHfModels.forEach(m => {
                if(!combinedHf.find(x => x.id === m.id)) combinedHf.push({ id: m.id, name: m.id.split('/')[1], tier: 'free' });
            });

            combinedHf.forEach(m => createLeaf(m, 'huggingface', m.tier, hfSub, () => renderFavorites(favSub)));
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

        function createLeaf(model, provider, tier, parent, onFavChange) {
            const div = document.createElement('div');
            div.className = 'menu-item model-leaf';
            const isFav = favoriteIds.includes(model.id);
            const badge = tier ? `<span class="hf-badge-${tier}">${tier.toUpperCase()}</span>` : '';
            
            div.innerHTML = `
                <span class="name" title="${model.id}">${model.name || model.id}${badge}</span>
                <span class="fav ${isFav ? 'active' : ''}">★</span>
            `;

            // Click sul nome: Seleziona il modello
            div.querySelector('.name').onclick = (e) => {
                e.stopPropagation();
                selectModel(model.id, provider, tier);
            };

            // Click sulla stella: Preferiti
            div.querySelector('.fav').onclick = (e) => {
                e.stopPropagation();
                toggleFav(model.id);
                renderFavorites(document.querySelector('.folder-fav + .submenu')); // Aggiorna UI preferiti
                div.querySelector('.fav').classList.toggle('active');
            };

            parent.appendChild(div);
        }

        function selectModel(id, provider, tier) {
            if (!window.CONFIG) return;
            window.CONFIG.MODEL = id;
            window.CONFIG.PROVIDER = provider;

            // Se è HF, configuriamo il proxy
            if (provider === 'huggingface') {
                window.CONFIG.API_URL = '/api/hf-proxy';
            } else {
                window.CONFIG.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
            }

            // Aggiorna UI globale
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
                createLeaf({id, name: id.split('/').pop()}, 'huggingface', 'free', container, () => renderFavorites(container));
            });
        }
    }

    initModelSelector();
}
