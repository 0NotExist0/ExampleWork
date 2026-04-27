/**
 * Script Selezione Modelli Finale: Gerarchia Mobile-First + Sistema Preferiti Persistente.
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

        mainTrigger.onclick = () => mainTrigger.classList.toggle('open');

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
            
            // 1. CARTELLA PREFERITI (Sempre in alto)
            const favFolderBtn = createFolderNode("⭐ I Miei Preferiti", mainSubmenu);
            favFolderBtn.classList.add('folder-fav');
            const favSubmenu = document.createElement('div');
            favSubmenu.className = 'submenu';
            mainSubmenu.appendChild(favSubmenu);

            renderFavoriteLeaves(favSubmenu);

            // 2. GERARCHIA CATALOGO COMPLETO
            const tree = {
                "🟢 GRATIS": { "Standard": [], "Reasoning": [] },
                "🟡 PREMIUM": { "Standard": [], "Reasoning": [] }
            };

            allModels.forEach(m => {
                const isFree = (m.pricing?.prompt === "0" || m.id.includes(':free'));
                const isReasoning = m.id.toLowerCase().includes('r1') ||
                                    m.id.toLowerCase().includes('reasoning') ||
                                    m.name.toLowerCase().includes('think');
                const branch = isFree ? "🟢 GRATIS" : "🟡 PREMIUM";
                const leaf = isReasoning ? "Reasoning" : "Standard";
                tree[branch][leaf].push(m);
            });

            for (let branch in tree) {
                const branchBtn = createFolderNode(branch, mainSubmenu);
                const branchSub = document.createElement('div');
                branchSub.className = 'submenu';
                mainSubmenu.appendChild(branchSub);

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
                <span class="model-name">${model.name}</span>
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
                renderAll();
            };

            parent.appendChild(leaf);
        }

        function renderFavoriteLeaves(container) {
            container.innerHTML = '';
            if (favoriteIds.length === 0) {
                container.innerHTML = '<div class="model-leaf" style="font-style:italic; opacity:0.5;">Nessun preferito...</div>';
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
