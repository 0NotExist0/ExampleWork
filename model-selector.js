/**
 * model-selector.js - Gestione Catalogo Dinamico
 */
if (!window.__modelSelectorLoaded) {
    window.__modelSelectorLoaded = true;

    async function initModelSelector() {
        const header = document.querySelector('header');
        if (!header || document.getElementById('model-menu-root')) return;

        // Root container
        const root = document.createElement('div');
        root.id = 'model-menu-root';
        root.innerHTML = `
            <div class="menu-item" id="main-trigger" style="background:#111; border-bottom:1px solid #333; padding:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                <span>📂 <b>Catalogo & Preferiti</b></span>
                <span id="active-model-name" style="color:#00ff88; font-size:11px;">Caricamento...</span>
                <span class="arrow">▼</span>
            </div>
            <div class="submenu" id="main-submenu" style="display:none; background:#1a1a1a; max-height:400px; overflow-y:auto; border-bottom:2px solid #00ff88;">
                <div style="padding:8px;"><input type="text" id="model-search" placeholder="🔍 Cerca modello..." style="width:100%; padding:6px; background:#222; color:white; border:1px solid #444; border-radius:4px;"></div>
                <div id="catalog-list"></div>
            </div>
        `;
        header.parentNode.insertBefore(root, header.nextSibling);

        const trigger = root.querySelector('#main-trigger');
        const submenu = root.querySelector('#main-submenu');
        const listCont = root.querySelector('#catalog-list');
        const searchInput = root.querySelector('#model-search');

        trigger.onclick = () => submenu.style.display = submenu.style.display === 'none' ? 'block' : 'none';

        let orModels = [];
        let hfModels = [];
        let favoriteIds = JSON.parse(localStorage.getItem('nemotron_favorites')) || [];

        // Fetch dei dati
        try {
            const [orRes, hfRes] = await Promise.all([
                fetch('https://openrouter.ai/api/v1/models').then(r => r.json()),
                fetch('https://huggingface.co/api/models?pipeline_tag=text-to-image&sort=downloads&direction=-1&limit=40&filter=inference').then(r => r.json())
            ]);
            orModels = orRes.data;
            hfModels = hfRes;
            renderList();
        } catch (e) {
            console.error("Errore caricamento catalogo:", e);
        }

        function renderList(filter = '') {
            listCont.innerHTML = '';
            
            // Sezione HF (Immagini)
            const hfHeader = document.createElement('div');
            hfHeader.style.padding = '5px 10px; background:#065f46; color:#6ee7b7; font-size:10px; font-weight:bold;';
            hfHeader.textContent = '🎨 HUGGING FACE (IMMAGINI)';
            listCont.appendChild(hfHeader);

            hfModels.filter(m => m.id.toLowerCase().includes(filter)).forEach(m => {
                createLeaf(m.id, m.id.split('/').pop(), 'huggingface', listCont);
            });

            // Sezione OpenRouter (Testo)
            const orHeader = document.createElement('div');
            orHeader.style.padding = '5px 10px; background:#1e3a8a; color:#93c5fd; font-size:10px; font-weight:bold; margin-top:10px;';
            orHeader.textContent = '✍️ OPENROUTER (CHAT)';
            listCont.appendChild(orHeader);

            orModels.filter(m => m.id.toLowerCase().includes(filter)).forEach(m => {
                createLeaf(m.id, m.name, 'openrouter', listCont);
            });
        }

        function createLeaf(id, name, provider, parent) {
            const leaf = document.createElement('div');
            leaf.style.padding = '8px 15px; border-bottom:1px solid #222; cursor:pointer; font-size:13px; color:#ccc; display:flex; justify-content:space-between;';
            leaf.innerHTML = `<span>${name}</span> <span style="font-size:9px; color:#555;">${provider === 'huggingface' ? 'IMG' : 'TXT'}</span>`;
            
            leaf.onclick = () => {
                window.CONFIG.MODEL = id;
                window.CONFIG.PROVIDER = provider;
                window.CONFIG.API_URL = (provider === 'huggingface') ? window.CONFIG.HF_PROXY_URL : window.CONFIG.OR_API_URL;
                
                document.getElementById('active-model-name').textContent = name;
                submenu.style.display = 'none';
                console.log(`🎯 Selezionato: ${id} via ${provider}`);
            };
            parent.appendChild(leaf);
        }

        searchInput.oninput = (e) => renderList(e.target.value.toLowerCase());
        
        // Inizializza etichetta
        document.getElementById('active-model-name').textContent = window.CONFIG.MODEL.split('/').pop();
    }

    initModelSelector();
}
