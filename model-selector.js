/**
 * Script Selezione Modelli Finale: Gerarchia Mobile-First + Preferiti + Ricerca + Divisione Visione/Generazione
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
            // Auto-focus sulla barra di ricerca quando si apre il menu
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
        } catch (e) { 
            mainTrigger.innerHTML = "<span>❌ Errore di Rete: Impossibile caricare i modelli</span>"; 
        }

        function renderAll() {
            mainSubmenu.innerHTML = '';
            
            // --- 0. BARRA DI RICERCA ---
            const searchContainer = document.createElement('div');
            // Stile inline di base per posizionamento sticky e visibilità
            searchContainer.style.cssText = 'padding: 8px; border-bottom: 1px solid #374151; position: sticky; top: 0; background: inherit; z-index: 10;';
            searchContainer.innerHTML = `
                <input type="text" id="model-search-input" placeholder="🔍 Cerca modello (es. flux, ocr, r1)..." 
                style="width: 100%; padding: 6px 10px; border-radius: 4px; border: 1px solid #4b5563; background: #1f2937; color: white; font-size: 13px; outline: none; box-sizing: border-box;">
            `;
            mainSubmenu.appendChild(searchContainer);

            const searchInput = searchContainer.querySelector('#model-search-input');

            // Contenitore per i risultati di ricerca (inizialmente nascosto)
            const searchResultsContainer = document.createElement('div');
            searchResultsContainer.style.display = 'none';
            mainSubmenu.appendChild(searchResultsContainer);

            // Contenitore per la normale gerarchia a cartelle
            const treeContainer = document.createElement('div');
            mainSubmenu.appendChild(treeContainer);

            // LOGICA DI FILTRAGGIO
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                
                if (query === '') {
                    // Ripristina la vista a cartelle
                    searchResultsContainer.style.display = 'none';
                    treeContainer.style.display = 'block';
                    searchResultsContainer.innerHTML = '';
                } else {
                    // Mostra i risultati "flat" nascondendo le cartelle
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
                                // Aggiorna graficamente la stellina anche nei risultati di ricerca
                                if (searchInput.value.trim() !== '') searchInput.dispatchEvent(new Event('input'));
                            });
                        });
                    }
                }
            });

            // --- 1. CARTELLA PREFERITI (Sempre in alto) ---
            const favFolderBtn = createFolderNode("⭐ I Miei Preferiti", treeContainer);
            favFolderBtn.classList.add('folder-fav');
            const favSubmenu = document.createElement('div');
            favSubmenu.className = 'submenu';
            treeContainer.appendChild(favSubmenu);

            renderFavoriteLeaves(favSubmenu);

            // --- 2. GERARCHIA CATALOGO COMPLETO AGGIORNATA ---
            const tree = {
                "🟢 GRATIS": { "Standard": [], "Reasoning": [], "👁️ Visione (Legge Foto)": [], "🎨 Genera Immagini": [] },
                "🟡 PREMIUM": { "Standard": [], "Reasoning": [], "👁️ Visione (Legge Foto)": [], "🎨 Genera Immagini": [] }
            };

            allModels.forEach(m => {
                const idLow = m.id.toLowerCase();
                const nameLow = m.name.toLowerCase();
                
                const isFree = (m.pricing?.prompt === "0" || idLow.includes(':free'));
                const isReasoning = idLow.includes('r1') || idLow.includes('reasoning') || nameLow.includes('think');
                
                // Riconoscimento Modelli di GENERAZIONE IMMAGINI (Text-to-Image)
                const genKeywords = ['flux', 'dall-e', 'stable-diffusion', 'sdxl', 'midjourney', 'image-generation'];
                const isGeneration = genKeywords.some(kw => idLow.includes(kw) || nameLow.includes(kw));

                // Riconoscimento Modelli di VISIONE/OCR (Image-to-Text)
                const visKeywords = ['vision', 'ocr', 'pixtral', 'llava', 'vl', 'qwen-vl'];
                let isVision = visKeywords.some(kw => idLow.includes(kw) || nameLow.includes(kw));
                
                // Fallback sui metadati di OpenRouter per identificare quelli non intercettati dal nome
                if (!isGeneration && !isVision && m.architecture && m.architecture.modality) {
                    const modality = m.architecture.modality.toLowerCase();
                    if (modality.includes('image')) isVision = true; 
                }

                // Smistamento logico
                const branch = isFree ? "🟢 GRATIS" : "🟡 PREMIUM";
                let leaf = "Standard";
                
                if (isGeneration) {
                    leaf = "🎨 Genera Immagini";
                } else if (isVision) {
                    leaf = "👁️ Visione (Legge Foto)";
                } else if (isReasoning) {
                    leaf = "Reasoning";
                }
                
                tree[branch][leaf].push(m);
            });

            // Rendering della struttura ad albero
            for (let branch in tree) {
                const branchBtn = createFolderNode(branch, treeContainer);
                const branchSub = document.createElement('div');
                branchSub.className = 'submenu';
                treeContainer.appendChild(branchSub);

                for (let leaf in tree[branch]) {
                    if (tree[branch][leaf].length === 0) continue; // Salta le cartelle vuote
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
                mainTrigger.classList.remove('open'); // Chiude il menu principale dopo la selezione
            };

            leaf.querySelector('.fav-toggle').onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(model.id);
                onFavChange();
                
                // Aggiorna lo stato visivo della singola foglia
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

        // --- LOGICA PREFERITI E AGGIORNAMENTO GLOBALE ---
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
