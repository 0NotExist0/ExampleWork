/**
 * Script di Selezione Modelli con Sincronizzazione Totale.
 * Gestisce Catalogo, Preferiti e aggiornamento del Main Engine.
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
    searchInput.placeholder = 'Cerca nel catalogo...';
    Object.assign(searchInput.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #334155',
        backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none'
    });

    // Riga Catalogo
    const row1 = document.createElement('div');
    row1.style.display = 'flex'; row1.style.gap = '8px';
    const mainSelect = document.createElement('select');
    Object.assign(mainSelect.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #334155',
        backgroundColor: '#0f172a', color: '#f8fafc', flex: '1', cursor: 'pointer'
    });
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '⭐';
    Object.assign(addBtn.style, { padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #3b82f6', backgroundColor: '#1e293b' });

    // Riga Preferiti
    const row2 = document.createElement('div');
    row2.style.display = 'flex'; row2.style.gap = '8px';
    const favSelect = document.createElement('select');
    Object.assign(favSelect.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #10b981',
        backgroundColor: '#0f172a', color: '#10b981', flex: '1', cursor: 'pointer'
    });
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '🗑️';
    Object.assign(delBtn.style, { padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ef4444', backgroundColor: '#1e293b' });

    row1.appendChild(mainSelect); row1.appendChild(addBtn);
    row2.appendChild(favSelect); row2.appendChild(delBtn);
    container.append(searchInput, row1, row2);
    header.parentNode.insertBefore(container, header.nextSibling);

    // --- LOGICA DATI ---
    let allModels = [];
    let favoriteIds = JSON.parse(localStorage.getItem('nemotron_favorites')) || [];

    /**
     * IL METODO CRUCIALE: Aggiorna il puntatore nel file script.js
     * e sincronizza graficamente l'intera interfaccia.
     */
    function syncActiveModel(modelId) {
        if (!modelId || !window.CONFIG) return;

        // 1. Sovrascrive il modello nello script principale
        window.CONFIG.MODEL = modelId;
        console.log("🎯 Modello Attivo Aggiornato:", window.CONFIG.MODEL);

        // 2. Sincronizza i menu a tendina
        if (mainSelect.value !== modelId) mainSelect.value = modelId;
        if (favoriteIds.includes(modelId)) {
            favSelect.value = modelId;
        } else {
            favSelect.selectedIndex = -1; // Deseleziona se non è tra i preferiti
        }

        // 3. Aggiorna il testo dell'header
        const status = document.querySelector('.status-indicator');
        if (status) {
            const shortName = modelId.split('/').pop();
            status.innerHTML = `Online - <span style="color:#60a5fa">${shortName}</span>`;
        }
    }

    // Caricamento API
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        const data = await res.json();
        allModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
        
        renderMain();
        renderFavs();
        
        // Al boot, sincronizza col modello di default definito in config.js
        syncActiveModel(window.CONFIG.MODEL);
    } catch (e) { console.error("Errore caricamento modelli"); }

    function renderMain(filtered = allModels) {
        mainSelect.innerHTML = '';
        const groups = {
            '🟢 Gratis': filtered.filter(m => (m.pricing?.prompt === "0" || m.id.includes(':free'))),
            '🟡 Premium': filtered.filter(m => !(m.pricing?.prompt === "0" || m.id.includes(':free')))
        };
        for (const [label, models] of Object.entries(groups)) {
            if (models.length > 0) {
                const g = document.createElement('optgroup'); g.label = label;
                models.forEach(m => {
                    const o = document.createElement('option'); o.value = m.id; o.textContent = m.name;
                    g.appendChild(o);
                });
                mainSelect.appendChild(g);
            }
        }
    }

    function renderFavs() {
        favSelect.innerHTML = favoriteIds.length ? '' : '<option value="">Nessun preferito</option>';
        favoriteIds.forEach(id => {
            const m = allModels.find(x => x.id === id);
            const o = document.createElement('option'); o.value = id;
            o.textContent = `⭐ ${m ? m.name : id}`;
            favSelect.appendChild(o);
        });
    }

    // --- LISTENERS ---
    
    // Cambio da Catalogo
    mainSelect.onchange = (e) => syncActiveModel(e.target.value);

    // Cambio da Preferiti (Quello che chiedevi: ora passa il dato al main script)
    favSelect.onchange = (e) => syncActiveModel(e.target.value);

    // Aggiungi
    addBtn.onclick = () => {
        const id = mainSelect.value;
        if (id && !favoriteIds.includes(id)) {
            favoriteIds.push(id);
            localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
            renderFavs();
            syncActiveModel(id);
        }
    };

    // Rimuovi
    delBtn.onclick = () => {
        const id = favSelect.value;
        favoriteIds = favoriteIds.filter(x => x !== id);
        localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
        renderFavs();
        syncActiveModel(mainSelect.value); // Torna al modello del catalogo
    };

    // Ricerca
    searchInput.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        renderMain(allModels.filter(m => m.name.toLowerCase().includes(term) || m.id.includes(term)));
    };
}

initModelSelector();
