/**
 * Model Selector — OpenRouter + HuggingFace (Immagini & Video Generativi)
 * Guard anti-duplicato
 */

if (!window.__modelSelectorLoaded) {
    window.__modelSelectorLoaded = true;

    // ─── Modelli HuggingFace curati (gratuiti via Inference API) ─────────────
    const HF_MODELS = {
        "🎨 Genera Immagini": [
            { id: "black-forest-labs/FLUX.1-schnell",          name: "FLUX.1 Schnell (veloce)" },
            { id: "black-forest-labs/FLUX.1-dev",              name: "FLUX.1 Dev (qualità)" },
            { id: "stabilityai/stable-diffusion-xl-base-1.0",  name: "Stable Diffusion XL" },
            { id: "stabilityai/stable-diffusion-3.5-large",    name: "Stable Diffusion 3.5 Large" },
            { id: "stabilityai/stable-diffusion-3-medium-diffusers", name: "Stable Diffusion 3 Medium" },
            { id: "Shakker-Labs/FLUX.1-dev-LoRA-AntiBlur",     name: "FLUX AntiBlur" },
            { id: "enhanceaiteam/Flux-Uncensored-V2",          name: "FLUX Uncensored V2" },
        ],
        "🎬 Genera Video": [
            { id: "ali-vilab/text-to-video-ms-1.7b",           name: "Text-to-Video MS 1.7B" },
            { id: "stabilityai/stable-video-diffusion-img2vid-xt", name: "Stable Video Diffusion XT" },
            { id: "genmo/mochi-1-preview",                     name: "Mochi 1 Preview" },
            { id: "Wan-AI/Wan2.1-T2V-14B-Diffusers",           name: "Wan2.1 T2V 14B" },
            { id: "tencent/HunyuanVideo",                      name: "HunyuanVideo" },
            { id: "Lightricks/LTX-Video",                      name: "LTX Video" },
        ]
    };
    // ─────────────────────────────────────────────────────────────────────────

    async function initModelSelector() {
        const header = document.querySelector('header');
        if (!header || document.getElementById('model-menu-root')) return;

        // ── Root container ──
        const rootContainer = document.createElement('div');
        rootContainer.id = 'model-menu-root';

        const mainTrigger = document.createElement('div');
        mainTrigger.className = 'menu-item';
        mainTrigger.innerHTML = `
            <span>📂 <b>Catalogo & Preferiti</b></span>
            <span id="active-model-name" style="color:#60a5fa;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;">Caricamento...</span>
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
                const s = document.getElementById('model-search-input');
                if (s) s.focus();
            }
        };

        // ── Stato ──
        let allOpenRouterModels = [];
        let favoriteIds = JSON.parse(localStorage.getItem('nemotron_favorites')) || [];

        // ── Fetch OpenRouter ──
        try {
            const res  = await fetch('https://openrouter.ai/api/v1/models');
            const data = await res.json();
            allOpenRouterModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
        } catch (e) {
            mainTrigger.innerHTML = "<span>❌ Errore rete: impossibile caricare i modelli OpenRouter</span>";
        }

        renderAll();
        if (window.CONFIG) updateGlobalUI(window.CONFIG.MODEL, window.CONFIG.PROVIDER || 'openrouter');

        // ════════════════════════════════════════════════════════════════════
        function renderAll() {
            mainSubmenu.innerHTML = '';

            // ── Barra di ricerca ──
            const searchWrap = document.createElement('div');
            searchWrap.style.cssText = 'padding:8px;border-bottom:1px solid #374151;position:sticky;top:0;background:inherit;z-index:10;';
            searchWrap.innerHTML = `<input type="text" id="model-search-input"
                placeholder="🔍 Cerca modello (es. flux, ocr, r1)..."
                style="width:100%;padding:6px 10px;border-radius:4px;border:1px solid #4b5563;background:#1f2937;color:white;font-size:13px;outline:none;box-sizing:border-box;">`;
            mainSubmenu.appendChild(searchWrap);

            const searchInput = searchWrap.querySelector('#model-search-input');

            const searchResults = document.createElement('div');
            searchResults.style.display = 'none';
            mainSubmenu.appendChild(searchResults);

            const treeContainer = document.createElement('div');
            mainSubmenu.appendChild(treeContainer);

            // Filtraggio live (OpenRouter + HF insieme)
            searchInput.addEventListener('input', e => {
                const q = e.target.value.toLowerCase().trim();
                if (!q) {
                    searchResults.style.display = 'none';
                    treeContainer.style.display = 'block';
                    searchResults.innerHTML = '';
                    return;
                }
                treeContainer.style.display = 'none';
                searchResults.style.display = 'block';
                searchResults.innerHTML = '';

                // OpenRouter
                const orHits = allOpenRouterModels.filter(m =>
                    m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
                );
                orHits.forEach(m => createModelLeaf(m, 'openrouter', searchResults, () => renderFavLeaves(favSub)));

                // HuggingFace
                Object.values(HF_MODELS).flat().filter(m =>
                    m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
                ).forEach(m => createModelLeaf(m, 'huggingface', searchResults, () => renderFavLeaves(favSub)));

                if (searchResults.children.length === 0)
                    searchResults.innerHTML = '<div class="model-leaf" style="font-style:italic;opacity:.5;padding:8px 12px;">Nessun risultato trovato...</div>';
            });

            // ── 1. Preferiti ──
            const favBtn = createFolderNode("⭐ I Miei Preferiti", treeContainer);
            favBtn.classList.add('folder-fav');
            const favSub = document.createElement('div');
            favSub.className = 'submenu';
            treeContainer.appendChild(favSub);
            renderFavLeaves(favSub);

            // ── 2. OpenRouter tree ──
            buildOpenRouterTree(treeContainer, favSub);

            // ── 3. HuggingFace tree ──
            buildHuggingFaceTree(treeContainer, favSub);
        }

        // ════════════════════════════════════════════════════════════════════
        // OpenRouter: gerarchia GRATIS / PREMIUM → Standard/Reasoning/Visione/Generazione
        function buildOpenRouterTree(parent, favSub) {
            const tree = {
                "🟢 GRATIS":   { "Standard": [], "Reasoning": [], "👁️ Visione": [], "🎨 Genera Immagini": [] },
                "🟡 PREMIUM":  { "Standard": [], "Reasoning": [], "👁️ Visione": [], "🎨 Genera Immagini": [] }
            };

            allOpenRouterModels.forEach(m => {
                const idL = m.id.toLowerCase();
                const nL  = m.name.toLowerCase();
                const isFree      = m.pricing?.prompt === "0" || idL.includes(':free');
                const isReasoning = idL.includes('r1') || idL.includes('reasoning') || nL.includes('think');
                const genKw  = ['flux','dall-e','stable-diffusion','sdxl','image-generation'];
                const isGen  = genKw.some(k => idL.includes(k) || nL.includes(k));
                const visKw  = ['vision','ocr','pixtral','llava','vl','qwen-vl'];
                let   isVis  = visKw.some(k => idL.includes(k) || nL.includes(k));
                if (!isGen && !isVis && m.architecture?.modality?.toLowerCase().includes('image')) isVis = true;

                const branch = isFree ? "🟢 GRATIS" : "🟡 PREMIUM";
                const leaf   = isGen ? "🎨 Genera Immagini" : isVis ? "👁️ Visione" : isReasoning ? "Reasoning" : "Standard";
                tree[branch][leaf].push(m);
            });

            const orSection = createFolderNode("🔀 OpenRouter", parent);
            const orSub = document.createElement('div');
            orSub.className = 'submenu';
            parent.appendChild(orSub);

            for (const branch in tree) {
                const bBtn = createFolderNode(branch, orSub);
                const bSub = document.createElement('div');
                bSub.className = 'submenu';
                orSub.appendChild(bSub);

                for (const leaf in tree[branch]) {
                    if (!tree[branch][leaf].length) continue;
                    createFolderNode(leaf, bSub);
                    const lSub = document.createElement('div');
                    lSub.className = 'submenu';
                    bSub.appendChild(lSub);
                    tree[branch][leaf].forEach(m => createModelLeaf(m, 'openrouter', lSub, () => renderFavLeaves(favSub)));
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // HuggingFace: sezione separata con categorie curate
        function buildHuggingFaceTree(parent, favSub) {
            const hfBtn = createFolderNode("🤗 HuggingFace (Gratuito)", parent);
            const hfSub = document.createElement('div');
            hfSub.className = 'submenu';
            parent.appendChild(hfSub);

            // Nota informativa
            const note = document.createElement('div');
            note.style.cssText = 'padding:6px 12px;font-size:11px;color:#9ca3af;border-bottom:1px solid #374151;';
            note.textContent = '⚠️ Richiede HF_API_KEY in CONFIG. Output: URL immagine/video.';
            hfSub.appendChild(note);

            for (const category in HF_MODELS) {
                createFolderNode(category, hfSub);
                const catSub = document.createElement('div');
                catSub.className = 'submenu';
                hfSub.appendChild(catSub);

                HF_MODELS[category].forEach(m => {
                    createModelLeaf(m, 'huggingface', catSub, () => renderFavLeaves(favSub));
                });
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // Nodi UI

        function createFolderNode(label, parent) {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.innerHTML = `<span>${label}</span><span class="arrow">▶</span>`;
            div.onclick = e => { e.stopPropagation(); div.classList.toggle('open'); };
            parent.appendChild(div);
            return div;
        }

        /**
         * @param {object} model    { id, name }
         * @param {string} provider 'openrouter' | 'huggingface'
         * @param {Element} parent
         * @param {Function} onFavChange
         */
        function createModelLeaf(model, provider, parent, onFavChange) {
            const leaf = document.createElement('div');
            leaf.className = 'menu-item model-leaf';
            const isFav = favoriteIds.includes(model.id);
            const badge = provider === 'huggingface'
                ? '<span style="font-size:10px;background:#7c3aed;color:white;padding:1px 5px;border-radius:3px;margin-left:4px;">HF</span>'
                : '';

            leaf.innerHTML = `
                <span class="model-name" title="${model.id}">${model.name}${badge}</span>
                <button class="fav-toggle ${isFav ? 'active' : ''}" title="Aggiungi ai preferiti">★</button>
            `;

            leaf.querySelector('.model-name').onclick = e => {
                e.stopPropagation();
                if (window.CONFIG) {
                    window.CONFIG.MODEL    = model.id;
                    window.CONFIG.PROVIDER = provider;

                    // Imposta l'endpoint corretto automaticamente
                    if (provider === 'huggingface') {
                        window.CONFIG.API_URL = `https://api-inference.huggingface.co/models/${model.id}`;
                        // Usa HF_API_KEY se disponibile, altrimenti rimane invariata
                        if (window.CONFIG.HF_API_KEY) {
                            window.CONFIG._activeKey = window.CONFIG.HF_API_KEY;
                        }
                    } else {
                        // Ripristina OpenRouter
                        window.CONFIG.API_URL = window.CONFIG.OR_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
                        window.CONFIG._activeKey = window.CONFIG.API_KEY;
                    }

                    updateGlobalUI(model.id, provider);
                }
                document.querySelector('#model-menu-root .menu-item')?.classList.remove('open');
            };

            leaf.querySelector('.fav-toggle').onclick = e => {
                e.stopPropagation();
                toggleFav(model.id);
                e.currentTarget.classList.toggle('active', favoriteIds.includes(model.id));
                onFavChange();
            };

            parent.appendChild(leaf);
        }

        function renderFavLeaves(container) {
            container.innerHTML = '';
            if (!favoriteIds.length) {
                container.innerHTML = '<div class="model-leaf" style="font-style:italic;opacity:.5;padding:8px 12px;">Nessun preferito...</div>';
                return;
            }
            favoriteIds.forEach(id => {
                // Cerca prima in OpenRouter, poi in HF
                const orModel = allOpenRouterModels.find(m => m.id === id);
                const hfModel = Object.values(HF_MODELS).flat().find(m => m.id === id);
                if (orModel) createModelLeaf(orModel, 'openrouter', container, () => renderFavLeaves(container));
                else if (hfModel) createModelLeaf(hfModel, 'huggingface', container, () => renderFavLeaves(container));
                else createModelLeaf({ id, name: id }, 'openrouter', container, () => renderFavLeaves(container));
            });
        }

        // ── Helpers ──
        function toggleFav(id) {
            favoriteIds = favoriteIds.includes(id)
                ? favoriteIds.filter(f => f !== id)
                : [...favoriteIds, id];
            localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
        }

        function updateGlobalUI(modelId, provider = 'openrouter') {
            const tag  = document.getElementById('active-model-name');
            const stat = document.querySelector('.status-indicator');
            const short = modelId.split('/').pop();
            const prefix = provider === 'huggingface' ? '🤗 ' : '';
            if (tag)  tag.innerText = prefix + short;
            if (stat) stat.innerHTML = `Online - <span style="color:#60a5fa">${prefix}${short}</span>`;
        }
    }

    initModelSelector();
}