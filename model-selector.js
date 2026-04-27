/**
 * Script indipendente per il caricamento, la selezione dinamica,
 * la categorizzazione e il SALVATAGGIO DEI PREFERITI (tramite localStorage come PlayerPrefs).
 */

async function initModelSelector() {
    const header = document.querySelector('header');
    
    // --- 1. COSTRUZIONE UI (Interfaccia) ---
    const selectorContainer = document.createElement('div');
    Object.assign(selectorContainer.style, {
        display: 'flex', flexDirection: 'column', gap: '10px',
        padding: '15px 20px', backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderBottom: '1px solid #334155'
    });

    // Campo di ricerca
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Cerca modello nel catalogo...';
    Object.assign(searchInput.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #334155',
        backgroundColor: '#0f172a', color: '#f8fafc', width: '100%', outline: 'none'
    });

    // Riga Catalogo Principale + Tasto Aggiungi
    const mainRow = document.createElement('div');
    mainRow.style.display = 'flex'; mainRow.style.gap = '8px';
    
    const mainSelect = document.createElement('select');
    Object.assign(mainSelect.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #334155',
        backgroundColor: '#0f172a', color: '#f8fafc', flex: '1', cursor: 'pointer', outline: 'none'
    });
    
    const addFavBtn = document.createElement('button');
    addFavBtn.innerHTML = '⭐';
    addFavBtn.title = 'Aggiungi ai Preferiti';
    Object.assign(addFavBtn.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #3b82f6',
        backgroundColor: '#1e293b', cursor: 'pointer', outline: 'none'
    });

    // Riga Preferiti + Tasto Rimuovi
    const favRow = document.createElement('div');
    favRow.style.display = 'flex'; favRow.style.gap = '8px';
    
    const favSelect = document.createElement('select');
    Object.assign(favSelect.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #10b981', // Bordo verde per i preferiti
        backgroundColor: '#0f172a', color: '#10b981', flex: '1', cursor: 'pointer', outline: 'none'
    });
    
    const removeFavBtn = document.createElement('button');
    removeFavBtn.innerHTML = '🗑️';
    removeFavBtn.title = 'Rimuovi dai Preferiti';
    Object.assign(removeFavBtn.style, {
        padding: '10px', borderRadius: '8px', border: '1px solid #ef4444',
        backgroundColor: '#1e293b', cursor: 'pointer', outline: 'none'
    });

    // Assemblaggio UI
    mainRow.appendChild(mainSelect);
    mainRow.appendChild(addFavBtn);
    favRow.appendChild(favSelect);
    favRow.appendChild(removeFavBtn);
    
    selectorContainer.appendChild(searchInput);
    selectorContainer.appendChild(mainRow);
    selectorContainer.appendChild(favRow);
    header.parentNode.insertBefore(selectorContainer, header.nextSibling);

    // --- 2. GESTIONE DATI (PlayerPrefs / localStorage) ---
    let allModels = [];
    // Carica la stringa JSON dal browser, se vuoto crea un array
    let favoriteIds = JSON.parse(localStorage.getItem('nemotron_favorites')) || [];

    function saveFavorites() {
        // Salva l'array convertendolo in stringa JSON
        localStorage.setItem('nemotron_favorites', JSON.stringify(favoriteIds));
        renderFavorites();
    }

    // --- 3. LOGICA DI RETE ---
    try {
        mainSelect.innerHTML = '<option>Scaricamento catalogo...</option>';
        favSelect.innerHTML = '<option>Caricamento preferiti...</option>';
        
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Errore API');
        
        const data = await response.json();
        allModels = data.data;
        allModels.sort((a, b) => a.id.localeCompare(b.id));
        
        renderMainOptions(allModels);
        renderFavorites();
    } catch (error) {
        mainSelect.innerHTML = '<option>Errore rete</option>';
        favSelect.innerHTML = '<option>Errore rete</option>';
    }

    // --- 4. FUNZIONI DI RENDERING ---
    function renderMainOptions(filteredModels) {
        mainSelect.innerHTML = ''; 
        if (filteredModels.length === 0) {
            mainSelect.innerHTML = '<option value="">Nessun modello trovato</option>';
            return;
        }

        const categories = {
            freeReasoning: { label: '🟢 GRATIS - Pensanti', models: [] },
            freeStandard:  { label: '🟢 GRATIS - Standard', models: [] },
            paidReasoning: { label: '🟡 PREMIUM - Pensanti', models: [] },
            paidStandard:  { label: '🟡 PREMIUM - Standard', models: [] }
        };

        filteredModels.forEach(model => {
            let isFree = false;
            if (model.pricing) {
                const p = parseFloat(model.pricing.prompt || "0");
                const c = parseFloat(model.pricing.completion || "0");
                if (p === 0 && c === 0) isFree = true;
            } 
            if (model.id.endsWith(':free')) isFree = true;

            const idL = model.id.toLowerCase();
            const nameL = model.name.toLowerCase();
            const isReasoning = idL.includes('deepseek-r1') || idL.includes('reasoning') || nameL.includes('think');

            if (isFree && isReasoning) categories.freeReasoning.models.push(model);
            else if (isFree && !isReasoning) categories.freeStandard.models.push(model);
            else if (!isFree && isReasoning) categories.paidReasoning.models.push(model);
            else categories.paidStandard.models.push(model);
        });

        Object.values(categories).forEach(cat => {
            if (cat.models.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = cat.label;
                cat.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = `${model.name}`; // Nome pulito
                    if (window.CONFIG && model.id === window.CONFIG.MODEL) option.selected = true;
                    optgroup.appendChild(option);
                });
                mainSelect.appendChild(optgroup);
            }
        });
    }

    function renderFavorites() {
        favSelect.innerHTML = '';
        if (favoriteIds.length === 0) {
            favSelect.innerHTML = '<option value="">Nessun preferito salvato</option>';
            return;
        }
        
        // Cerca i dati completi dei modelli basandosi sugli ID salvati
        favoriteIds.forEach(id => {
            const modelData = allModels.find(m => m.id === id);
            const option = document.createElement('option');
            option.value = id;
            option.textContent = modelData ? `⭐ ${modelData.name}` : `⭐ ${id} (Sconosciuto)`;
            
            if (window.CONFIG && id === window.CONFIG.MODEL) option.selected = true;
            favSelect.appendChild(option);
        });
    }

    // --- 5. EVENT LISTENERS ---

    // Aggiorna il Manager Globale quando cambi modello
    function updateGlobalModel(newId) {
        if (newId && window.CONFIG) {
            window.CONFIG.MODEL = newId; 
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                const shortName = newId.split('/').pop();
                statusIndicator.innerHTML = `Online - <span style="color:#f8fafc; margin-left:4px">${shortName}</span>`;
            }
        }
    }

    // Cambi modello dal catalogo principale
    mainSelect.addEventListener('change', (e) => {
        updateGlobalModel(e.target.value);
        // Sincronizza visivamente la tendina dei preferiti se il modello scelto è lì
        if (favoriteIds.includes(e.target.value)) favSelect.value = e.target.value;
    });

    // Cambi modello dai preferiti
    favSelect.addEventListener('change', (e) => {
        updateGlobalModel(e.target.value);
        // Sincronizza visivamente il catalogo principale
        mainSelect.value = e.target.value;
    });

    // Tasto Aggiungi ai Preferiti
    addFavBtn.addEventListener('click', () => {
        const currentId = mainSelect.value;
        if (currentId && !favoriteIds.includes(currentId)) {
            favoriteIds.push(currentId);
            saveFavorites(); // Salva nel localStorage
            favSelect.value = currentId; // Selezionalo subito
            console.log("Aggiunto ai preferiti:", currentId);
        }
    });

    // Tasto Rimuovi dai Preferiti
    removeFavBtn.addEventListener('click', () => {
        const currentId = favSelect.value;
        if (currentId) {
            favoriteIds = favoriteIds.filter(id => id !== currentId);
            saveFavorites(); // Aggiorna il localStorage
            console.log("Rimosso dai preferiti:", currentId);
            
            // Se svuotiamo i preferiti, resettiamo la selezione al mainSelect
            if(favoriteIds.length > 0) {
                updateGlobalModel(favSelect.value);
            } else {
                updateGlobalModel(mainSelect.value);
            }
        }
    });

    // Ricerca
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allModels.filter(m => 
            m.name.toLowerCase().includes(searchTerm) || 
            m.id.toLowerCase().includes(searchTerm)
        );
        renderMainOptions(filtered);
    });
}

initModelSelector();
