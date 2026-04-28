/**
 * Model Selector — OpenRouter + HuggingFace (Immagini & Video Generativi)
 * Guard anti-duplicato
 */

if (!window.__modelSelectorLoaded) {
    window.__modelSelectorLoaded = true;

    // ─── Modelli HuggingFace — separati per tier ──────────────────────────────
    const HF_MODELS = {
        "🎨 Genera Immagini": {
            free: [
                { id: "black-forest-labs/FLUX.1-schnell",         name: "FLUX.1 Schnell (veloce)" },
                { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "Stable Diffusion XL" },
            ],
            pro: [
                { id: "black-forest-labs/FLUX.1-dev",                    name: "FLUX.1 Dev (qualità)" },
                { id: "enhanceaiteam/Flux-Uncensored-V2",                name: "FLUX Uncensored V2" },
                { id: "stabilityai/stable-diffusion-3.5-large",          name: "Stable Diffusion 3.5 Large" },
                { id: "stabilityai/stable-diffusion-3-medium-diffusers", name: "Stable Diffusion 3 Medium" },
                { id: "Shakker-Labs/FLUX.1-dev-LoRA-AntiBlur",           name: "FLUX AntiBlur" },
            ],
        },
        "🎬 Genera Video": {
            free: [
                { id: "ali-vilab/text-to-video-ms-1.7b", name: "Text-to-Video MS 1.7B" },
                { id: "genmo/mochi-1-preview",            name: "Mochi 1 Preview" },
                { id: "Lightricks/LTX-Video",             name: "LTX Video" },
            ],
            pro: [
                { id: "stabilityai/stable-video-diffusion-img2vid-xt", name: "Stable Video Diffusion XT" },
                { id: "Wan-AI/Wan2.1-T2V-14B-Diffusers",              name: "Wan2.1 T2V 14B" },
                { id: "tencent/HunyuanVideo",                         name: "HunyuanVideo" },
            ],
        }
    };

    // Flat list per ricerca e preferiti
    function allHfModels() {
        const out = [];
        for (const cat of Object.values(HF_MODELS)) {
            cat.free.forEach(m => out.push({ ...m, _hfTier: 'free' }));
            cat.pro.forEach(m => out.push({ ...m, _hfTier: 'pro' }));
        }
        return out;
    }
    // ─────────────────────────────────────────────────────────────────────────

    async function initModelSelector() {
        const header = document.querySelector('header');
        if (!header || document.getElementById('model-menu-root')) return;

        // Stili badge tier
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .hf-badge-free {
                font-size: 9px;
                background: #065f46;
                color: #6ee7b7;
                padding: 1px 5px;
                border-radius: 3px;
                margin-left: 4px;
                font-weight: bold;
                letter-spacing: 0.3px;
            }
            .hf-badge-pro {
                font-size: 9px;
                background: #78350f;
                color: #fcd34d;
                padding: 1px 5px;
                border-radius: 3px;
                margin-left: 4px;
                font-weight: bold;
                letter-spacing: 0.3px;
            }
            .tier-header-free {
                padding: 4px 12px 2px;
                font-size: 10px;
                color: #6ee7b7;
                font-weight: bold;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                border-top: 1px solid #1f4037;
                margin-top: 4px;
            }
            .tier-header-pro {
                padding: 4px 12px 2px;
                font-size: 10px;
                color: #fcd34d;
                font-weight: bold;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                border-top: 1px solid #44200a;
                margin-top: 4px;
            }
            .tier-pro-warning {
                padding: 2px 12px 6px;
                font-size: 10px;
                color: #9ca3af;
                font-style: italic;
            }
        `;
        document.head.appendChild(styleTag);

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

            const searchResults = document.createElement('div');
            searchResults.style.display = 'none';
            mainSubmenu.appendChild(searchResults);

            const treeContainer = document.createElement('div');
            mainSubmenu.appendChild(treeContainer);

            const searchInput = searchWrap.querySelector('#model-search-input');

            // Filtraggio live
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
                allOpenRouterModels
                    .filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
                    .forEach(m => createModelLeaf(m, 'openrouter', null, searchResults, () => renderFavLeaves(favSub)));

                // HuggingFace (free + pro)
                allHfModels()
                    .filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
                    .forEach(m => createModelLeaf(m, 'huggingface', m._hfTier, searchResults, () => renderFavLeaves(favSub)));

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

            createFolderNode("🔀 OpenRouter", parent);
            const orSub = document.createElement('div');
            orSub.className = 'submenu';
            parent.appendChild(orSub);

            for (const branch in tree) {
                createFolderNode(branch, orSub);
                const bSub = document.createElement('div');
                bSub.className = 'submenu';
                orSub.appendChild(bSub);

                for (const leaf in tree[branch]) {
                    if (!tree[branch][leaf].length) continue;
                    createFolderNode(leaf, bSub);
                    const lSub = document.createElement('div');
                    lSub.className = 'submenu';
                    bSub.appendChild(lSub);
                    tree[branch][leaf].forEach(m => createModelLeaf(m, 'openrouter', null, lSub, () => renderFavLeaves(favSub)));
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // HuggingFace: sezione con tier FREE / PRO separati per categoria
        function buildHuggingFaceTree(parent, favSub) {
            createFolderNode("🤗 HuggingFace", parent);
            const hfSub = document.createElement('div');
            hfSub.className = 'submenu';
            parent.appendChild(hfSub);

            // Nota chiave API
            const note = document.createElement('div');
            note.style.cssText = 'padding:6px 12px;font-size:11px;color:#9ca3af;border-bottom:1px solid #374151;';
            note.textContent = '⚠️ Richiede HF_API_KEY in CONFIG.';
            hfSub.appendChild(note);

            for (const [category, tiers] of Object.entries(HF_MODELS)) {
                // Cartella categoria (es. "🎨 Genera Immagini")
                createFolderNode(category, hfSub);
                const catSub = document.createElement('div');
                catSub.className = 'submenu';
                hfSub.appendChild(catSub);

                // ── Tier GRATUITO ──
                if (tiers.free.length > 0) {
                    const freeHeader = document.createElement('div');
                    freeHeader.className = 'tier-header-free';
                    freeHeader.textContent = '✅ Gratuito (Inference API)';
                    catSub.appendChild(freeHeader);
                    tiers.free.forEach(m =>
                        createModelLeaf(m, 'huggingface', 'free', catSub, () => renderFavLeaves(favSub))
                    );
                }

                // ── Tier PRO ──
                if (tiers.pro.length > 0) {
                    const proHeader = document.createElement('div');
                    proHeader.className = 'tier-header-pro';
                    proHeader.textContent = '🔒 Richiede HF Pro';
                    catSub.appendChild(proHeader);

                    const proWarn = document.createElement('div');
                    proWarn.className = 'tier-pro-warning';
                    proWarn.textContent = 'Abbonamento a pagamento o modello gated (licenza da accettare su HF)';
                    catSub.appendChild(proWarn);

                    tiers.pro.forEach(m =>
                        createModelLeaf(m, 'huggingface', 'pro', catSub, () => renderFavLeaves(favSub))
                    );
                }
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
         * @param {string|null} hfTier  'free' | 'pro' | null
         * @param {Element} parent
         * @param {Function} onFavChange
         */
        function createModelLeaf(model, provider, hfTier, parent, onFavChange) {
            const leaf = document.createElement('div');
            leaf.className = 'menu-item model-leaf';
            const isFav = favoriteIds.includes(model.id);

            let badge = '';
            if (provider === 'huggingface') {
                if (hfTier === 'pro') {
                    badge = '<span class="hf-badge-pro">HF PRO</span>';
                } else {
                    badge = '<span class="hf-badge-free">HF FREE</span>';
                }
            }

            leaf.innerHTML = `
                <span class="model-name" title="${model.id}">${model.name}${badge}</span>
                <button class="fav-toggle ${isFav ? 'active' : ''}" title="Aggiungi ai preferiti">★</button>
            `;

            leaf.querySelector('.model-name').onclick = e => {
                e.stopPropagation();
                if (window.CONFIG) {
                    window.CONFIG.MODEL    = model.id;
                    window.CONFIG.PROVIDER = provider;

                    if (provider === 'huggingface') {
                        window.CONFIG.API_URL = `https://api-inference.huggingface.co/models/${model.id}`;

                        // Leggi la chiave HF: prima da CONFIG, poi da localStorage (qualsiasi chiave che inizia con "hf_")
                        const hfKey = window.CONFIG.HF_API_KEY
                            || (() => {
                                for (let i = 0; i < localStorage.length; i++) {
                                    const k = localStorage.key(i);
                                    if (k && k.toUpperCase().startsWith('HUGGINGFACE')) {
                                        const v = localStorage.getItem(k);
                                        if (v && v.startsWith('hf_')) return v;
                                    }
                                }
                                return null;
                            })();

                        if (hfKey) {
                            window.CONFIG._activeKey = hfKey;
                            console.log('🤗 Chiave HF impostata correttamente:', hfKey.substring(0, 8) + '...');
                        } else {
                            console.error('❌ Nessuna chiave HF trovata! Aggiungila nelle impostazioni come HF_API_KEY.');
                        }

                        if (hfTier === 'pro') {
                            console.warn(`⚠️ [HF Pro] "${model.name}" richiede un abbonamento HF Pro attivo e l'accettazione della licenza su huggingface.co`);
                        }
                    } else {
                        window.CONFIG.API_URL    = window.CONFIG.OR_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
                        window.CONFIG._activeKey = window.CONFIG.API_KEY;
                    }

                    updateGlobalUI(model.id, provider, hfTier);
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
            const flatHf = allHfModels();
            favoriteIds.forEach(id => {
                const orModel = allOpenRouterModels.find(m => m.id === id);
                const hfModel = flatHf.find(m => m.id === id);
                if (orModel) createModelLeaf(orModel, 'openrouter', null, container, () => renderFavLeaves(container));
                else if (hfModel) createModelLeaf(hfModel, 'huggingface', hfModel._hfTier, container, () => renderFavLeaves(container));
                else createModelLeaf({ id, name: id }, 'openrouter', null, container, () => renderFavLeaves(container));
            });
        }

        // ── Helpers ──
        function toggleFav(id) {
            favoriteIds = favoriteIds.includes(id)
                ? favoriteIds.filter(f => f !== id)
                : [...favoriteIds, id];
            localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
        }

        function updateGlobalUI(modelId, provider = 'openrouter', hfTier = null) {
            const tag  = document.getElementById('active-model-name');
            const stat = document.querySelector('.status-indicator');
            const short = modelId.split('/').pop();
            let prefix = '';
            if (provider === 'huggingface') {
                prefix = hfTier === 'pro' ? '🔒 ' : '🤗 ';
            }
            if (tag)  tag.innerText = prefix + short;
            if (stat) stat.innerHTML = `Online - <span style="color:#60a5fa">${prefix}${short}</span>`;
        }
    }

    initModelSelector();
}
