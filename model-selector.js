/**
 * Script Selezione Modelli Finale: Gerarchia Mobile-First + Sistema Preferiti Persistente + Ricerca + Multimodali.
 * Guard anti-duplicato: evita doppia inizializzazione se lo script viene caricato due volte.
 */

if (!window.__modelSelectorLoaded) {
    window.__modelSelectorLoaded = true;

    async function initModelSelector() {
        const header = document.querySelector('header');
        if (!header) return;

        // Evita di reinserire il menu se già presente nel DOM
        if (document.getElementById('model-menu-root')) return;

        // --- SETUP UI ---
        const rootContainer = document.createElement('div');
        rootContainer.id = 'model-menu-root';
        
        const mainTrigger = document.createElement('div');
        mainTrigger.className = 'menu-item';
        mainTrigger.innerHTML = `
            <span>📂 <b>Catalogo & Preferiti</b></span>
            <span id="active-model-name" style="color:#60a5fa; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;">Caricamento...</span>
            <span class="arrow">▶</span>
        `;
        
        const mainSubmenu = document.createElement('div');
        mainSubmenu.className = 'submenu';
        
        rootContainer.appendChild(mainTrigger);
        rootContainer.appendChild(mainSubmenu);
        header.parentNode.insertBefore(rootContainer, header.nextSibling);

        mainTrigger.onclick = () => {
            mainTrigger.classList.toggle('open');
            if (mainTrigger.classList.contains('open')) {
                const searchInput = document.getElementById('model-search-input');
                if (searchInput) searchInput.focus();
            }
        };

        // --- DATI & PREFERITI ---
        let allModels = [];
        let favoriteIds = JSON.parse(localStorage.getItem('nemotron_favorites')) || [];

        try {
            const response = await fetch('https://openrouter.ai/api/v1/models');
            const data = await response.json();
            allModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
            
            renderAll();
            if (window.CONFIG) updateGlobalUI(window.CONFIG.MODEL);
        } catch (e) { mainTrigger.innerHTML = "<span>❌ Errore di Rete</span>"; }

        function renderAll() {
            mainSubmenu.innerHTML = '';
            
            // --- 0. BARRA DI RICERCA ---
            const searchContainer = document.createElement('div');
            searchContainer.style.cssText = 'padding: 8px; border-bottom: 1px solid #374151; position: sticky; top: 0; background: inherit; z-index: 10;';
            searchContainer.innerHTML = `
                <input type="text" id="model-search-input" placeholder="🔍 Cerca modello..." 
                style="width: 100%; padding: 6px 10px; border-radius: 4px; border: 1px solid #4b5563; background: #1f2937; color: white; font-size: 13px; outline: none; box-sizing: border-box;">
            `;
            mainSubmenu.appendChild(searchContainer);

            const searchInput = searchContainer.querySelector('#model-search-input');
            const searchResultsContainer = document.createElement('div');
            searchResultsContainer.style.display = 'none';
            mainSubmenu.appendChild(searchResultsContainer);

            const treeContainer = document.createElement('div');
            mainSubmenu.appendChild(treeContainer);

            // LOGICA DI FILTRAGGIO
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                
                if (query === '') {
                    searchResultsContainer.style.display = 'none';
                    treeContainer.style.display = 'block';
                    searchResultsContainer.innerHTML = '';
                } else {
                    treeContainer.style.display = 'none';
                    searchResultsContainer.style.display = 'block';
                    searchResultsContainer.innerHTML = '';

                    const filtered = allModels.filter(m => 
                        m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query)
                    );

                    if (filtered.length === 0) {
                        searchResultsContainer.innerHTML = '<div class="model-leaf" style="font-style:italic; opacity:0.5; padding: 8px 12px;">Nessun risultato trovato...</div>';
                    } else {
                        filtered.forEach(model => {
                            createModelLeaf(model, searchResultsContainer, () => {
                                renderFavoriteLeaves(favSubmenu);
                                if (searchInput.value.trim() !== '') searchInput.dispatchEvent(new Event('input'));
                            });
                        });
                    }
                }
            });

            // --- 1. CARTELLA PREFERITI ---
            const favFolderBtn = createFolderNode("⭐ I Miei Preferiti", treeContainer);
            favFolderBtn.classList.add('folder-fav');
            const favSubmenu = document.createElement('div');
            favSubmenu.className = 'submenu';
            treeContainer.appendChild(favSubmenu);

            renderFavoriteLeaves(favSubmenu);

            // --- 2. GERARCHIA CATALOGO COMPLETO AGGIORNATA ---
            const tree = {
                "🟢 GRATIS": { "Standard": [], "Reasoning": [], "🎨 Immagini & Video": [] },
                "🟡 PREMIUM": { "Standard": [], "Reasoning": [], "🎨 Immagini & Video": [] }
            };

            allModels.forEach(m => {
                const idLow = m.id.toLowerCase();
                const nameLow = m.name.toLowerCase();
                
                // Determina il costo
                const isFree = (m.pricing?.prompt === "0" || idLow.includes(':free'));
                
                // Determina se è Reasoning
                const isReasoning = idLow.includes('r1') || idLow.includes('reasoning') || nameLow.includes('think');
                
                // Determina se è Multimodale/Immagini/Video
                let isMedia = false;
                
                // Controllo 1: tramite metadati ufficiali di OpenRouter (modality)
                if (m.architecture && m.architecture.modality) {
                    const modality = m.architecture.modality.toLowerCase();
                    if (modality.includes('image') || modality.includes('video')) {
                        isMedia = true;
                    }
                }
                
                // Controllo 2: fallback sulle keyword nel nome o ID se i metadati mancano
                if (!isMedia) {
                    const mediaKeywords = ['vision', 'flux', 'dall-e', 'stable-diffusion', 'sdxl', 'midjourney', 'runway', 'luma', 'kling', 'pixtral', 'image', 'video'];
                    isMedia = mediaKeywords.some(kw => idLow.includes(kw) || nameLow.includes(kw));
                }

                // Assegnazione alla cartella corretta
                const branch = isFree ? "🟢 GRATIS" : "🟡 PREMIUM";
                let leaf = "Standard";
                
                if (isMedia) {
                    leaf = "🎨 Immagini & Video";
                } else if (isReasoning) {
                    leaf = "Reasoning";
                }
                
                tree[branch][leaf].push(m);
            });

            // Rendering del menu
            for (let branch in tree) {
                const branchBtn = createFolderNode(branch, treeContainer);
                const branchSub = document.createElement('div');
                branchSub.className = 'submenu';
                treeContainer.appendChild(branchSub);

                for (let leaf in tree[branch]) {
                    if (tree[branch][leaf].length === 0) continue;
                    const leafBtn = createFolderNode(leaf, branchSub);
                    const leafSub = document.createElement('div');
                    leafSub.className = 'submenu';
                    branchSub.appendChild(leafSub);

                    tree[branch][leaf].forEach(model => {
                        createModelLeaf(model, leafSub, () => renderFavoriteLeaves(favSubmenu));
                    });
                }
            }
        }

        // --- FUNZIONI CREAZIONE NODI ---
        function createFolderNode(label, parent) {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.innerHTML = `<span>${label}</span> <span class="arrow">▶</span>`;
            div.onclick = (e) => { e.stopPropagation(); div.classList.toggle('open'); };
            parent.appendChild(div);
            return div;
        }

        function createModelLeaf(model, parent, onFavChange) {
            const leaf = document.createElement('div');
            leaf.className = 'menu-item model-leaf';
            
            const isFav = favoriteIds.includes(model.id);

            leaf.innerHTML = `
                <span class="model-name" title="${model.id}">${model.name}</span>
                <button class="fav-toggle ${isFav ? 'active' : ''}" title="Aggiungi ai preferiti">★</button>
            `;

            leaf.querySelector('.model-name').onclick = (e) => {
                e.stopPropagation();
                if (window.CONFIG) {
                    window.CONFIG.MODEL = model.id;
                    updateGlobalUI(model.id);
                }
                mainTrigger.classList.remove('open');
            };

            leaf.querySelector('.fav-toggle').onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(model.id);
                onFavChange();
                
                const btn = e.currentTarget;
                if (favoriteIds.includes(model.id)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            };

            parent.appendChild(leaf);
        }

        function renderFavoriteLeaves(container) {
            container.innerHTML = '';
            if (favoriteIds.length === 0) {
                container.innerHTML = '<div class="model-leaf" style="font-style:italic; opacity:0.5; padding: 8px 12px;">Nessun preferito...</div>';
                return;
            }

            favoriteIds.forEach(id => {
                const mData = allModels.find(m => m.id === id) || { name: id, id: id };
                createModelLeaf(mData, container, () => renderFavoriteLeaves(container));
            });
        }

        // --- LOGICA PREFERITI ---
        function toggleFavorite(id) {
            if (favoriteIds.includes(id)) {
                favoriteIds = favoriteIds.filter(favId => favId !== id);
            } else {
                favoriteIds.push(id);
            }
            localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
        }

        function updateGlobalUI(modelId) {
            const activeNameTag = document.getElementById('active-model-name');
            const statusIndicator = document.querySelector('.status-indicator');
            const shortName = modelId.split('/').pop();
            if (activeNameTag) activeNameTag.innerText = shortName;
            if (statusIndicator) statusIndicator.innerHTML = `Online - <span style="color:#60a5fa">${shortName}</span>`;
        }
    }

    initModelSelector();
}
