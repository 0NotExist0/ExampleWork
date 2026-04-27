/**
 * Script di Selezione Modelli Categorizzato e User-Friendly.
 * Organizza i modelli in Gratis/Premium e Standard/Pensanti.
 */

async function initModelSelector() {
    const header = document.querySelector('header');
    
    // --- UI SETUP ---
    const container = document.createElement('div');
    Object.assign(container.style, {
        display: 'flex', flexDirection: 'column', gap: '10px',
        padding: '15px 20px', backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderBottom: '1px solid #334155'
    });

    const searchInput = document.createElement('input');
    searchInput.placeholder = 'Cerca nel catalogo (es: deepseek, llama...)';
    Object.assign(searchInput.style, {
        padding: '12px', borderRadius: '8px', border: '1px solid #334155',
        backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none', fontSize: '14px'
    });

    // Riga Catalogo
    const row1 = document.createElement('div');
    row1.style.display = 'flex'; row1.style.gap = '8px';
    const mainSelect = document.createElement('select');
    Object.assign(mainSelect.style, {
        padding: '12px', borderRadius: '8px', border: '1px solid #334155',
        backgroundColor: '#0f172a', color: '#f8fafc', flex: '1', cursor: 'pointer', outline: 'none'
    });
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '⭐';
    Object.assign(addBtn.style, { padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #3b82f6', backgroundColor: '#1e293b' });

    // Riga Preferiti
    const row2 = document.createElement('div');
    row2.style.display = 'flex'; row2.style.gap = '8px';
    const favSelect = document.createElement('select');
    Object.assign(favSelect.style, {
        padding: '12px', borderRadius: '8px', border: '1px solid #10b981',
        backgroundColor: '#0f172a', color: '#10b981', flex: '1', cursor: 'pointer', outline: 'none'
    });
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '🗑️';
    Object.assign(delBtn.style, { padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ef4444', backgroundColor: '#1e293b' });

    row1.appendChild(mainSelect); row1.appendChild(addBtn);
    row2.appendChild(favSelect); row2.appendChild(delBtn);
    container.append(searchInput, row1, row2);
    header.parentNode.insertBefore(container, header.nextSibling);

    let allModels = [];
    let favoriteIds = JSON.parse(localStorage.getItem('nemotron_favorites')) || [];

    // --- LOGICA DI SINCRONIZZAZIONE ---
    function syncActiveModel(modelId) {
        if (!modelId || !window.CONFIG) return;
        window.CONFIG.MODEL = modelId;
        
        if (mainSelect.value !== modelId) mainSelect.value = modelId;
        favSelect.value = favoriteIds.includes(modelId) ? modelId : "";

        const status = document.querySelector('.status-indicator');
        if (status) {
            const shortName = modelId.split('/').pop();
            status.innerHTML = `Online - <span style="color:#60a5fa">${shortName}</span>`;
        }
    }

    // --- CARICAMENTO E SMISTAMENTO ---
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        const data = await res.json();
        allModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
        
        renderMain();
        renderFavs();
        syncActiveModel(window.CONFIG.MODEL);
    } catch (e) { console.error("Errore caricamento modelli"); }

    function renderMain(filtered = allModels) {
        mainSelect.innerHTML = '';
        
        // Categorie logiche (Il sottomenu ordinato)
        const categories = {
            freeReasoning: { label: '🟢 GRATIS - Modelli Pensanti (Reasoning)', models: [] },
            freeStandard:  { label: '🟢 GRATIS - Modelli Standard', models: [] },
            paidReasoning: { label: '🟡 PREMIUM - Modelli Pensanti (Reasoning)', models: [] },
            paidStandard:  { label: '🟡 PREMIUM - Modelli Standard', models: [] }
        };

        filtered.forEach(m => {
            // Check Prezzo
            const isFree = (m.pricing?.prompt === "0" || m.id.includes(':free'));
            
            // Check Ragionamento
            const idL = m.id.toLowerCase();
            const nameL = m.name.toLowerCase();
            const isReasoning = idL.includes('r1') || idL.includes('reasoning') || nameL.includes('think') || idL.includes('thinking');

            if (isFree && isReasoning) categories.freeReasoning.models.push(m);
            else if (isFree && !isReasoning) categories.freeStandard.models.push(m);
            else if (!isFree && isReasoning) categories.paidReasoning.models.push(m);
            else categories.paidStandard.models.push(m);
        });

        // Creazione visiva degli OptGroup
        Object.values(categories).forEach(cat => {
            if (cat.models.length > 0) {
                const group = document.createElement('optgroup');
                group.label = cat.label;
                cat.models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name;
                    group.appendChild(opt);
                });
                mainSelect.appendChild(group);
            }
        });
    }

    function renderFavs() {
        favSelect.innerHTML = favoriteIds.length ? '' : '<option value="">⭐ Nessun preferito</option>';
        favoriteIds.forEach(id => {
            const m = allModels.find(x => x.id === id);
            const o = document.createElement('option'); o.value = id;
            o.textContent = `⭐ ${m ? m.name : id}`;
            favSelect.appendChild(o);
        });
    }

    // --- EVENTI ---
    mainSelect.onchange = (e) => syncActiveModel(e.target.value);
    favSelect.onchange = (e) => syncActiveModel(e.target.value);

    addBtn.onclick = () => {
        const id = mainSelect.value;
        if (id && !favoriteIds.includes(id)) {
            favoriteIds.push(id);
            localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
            renderFavs();
            syncActiveModel(id);
        }
    };

    delBtn.onclick = () => {
        const id = favSelect.value;
        if (!id) return;
        favoriteIds = favoriteIds.filter(x => x !== id);
        localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
        renderFavs();
        syncActiveModel(mainSelect.value);
    };

    searchInput.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        renderMain(allModels.filter(m => m.name.toLowerCase().includes(term) || m.id.includes(term)));
    };
}

initModelSelector();
