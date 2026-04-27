/**
 * Script indipendente per il caricamento, la ricerca e la selezione
 * dinamica dei modelli tramite l'API di OpenRouter.
 */

async function initModelSelector() {
    // 1. Costruzione dell'Interfaccia Utente (UI)
    const header = document.querySelector('header');
    
    // Contenitore per i controlli
    const selectorContainer = document.createElement('div');
    Object.assign(selectorContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '15px 20px',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderBottom: '1px solid #334155'
    });

    // Campo di ricerca testuale
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Cerca modello (es. nemotron, llama, gpt...)';
    Object.assign(searchInput.style, {
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid #334155',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        width: '100%',
        outline: 'none'
    });

    // Menu a tendina (Dropdown)
    const selectDropdown = document.createElement('select');
    Object.assign(selectDropdown.style, {
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid #334155',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        width: '100%',
        cursor: 'pointer',
        outline: 'none'
    });

    // Aggiunge gli elementi al DOM sotto l'header principale
    selectorContainer.appendChild(searchInput);
    selectorContainer.appendChild(selectDropdown);
    header.parentNode.insertBefore(selectorContainer, header.nextSibling);

    // 2. Recupero dei Modelli dall'API
    let allModels = [];
    try {
        selectDropdown.innerHTML = '<option>Scaricamento modelli in corso...</option>';
        
        // OpenRouter fornisce un endpoint pubblico per la lista dei modelli
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Errore di rete');
        
        const data = await response.json();
        allModels = data.data; // OpenRouter inserisce l'array nell'oggetto "data"
        
        // Ordina i modelli in ordine alfabetico per ID
        allModels.sort((a, b) => a.id.localeCompare(b.id));
        
        renderOptions(allModels);
    } catch (error) {
        console.error("Errore nel caricamento dei modelli:", error);
        selectDropdown.innerHTML = '<option>Errore nel caricamento dei modelli</option>';
    }

    // 3. Funzione di Rendering delle Opzioni
    function renderOptions(filteredModels) {
        selectDropdown.innerHTML = ''; // Svuota la tendina
        
        if (filteredModels.length === 0) {
            selectDropdown.innerHTML = '<option value="">Nessun modello trovato</option>';
            return;
        }
        
        filteredModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            // Mostra sia il nome amichevole che l'ID tecnico
            option.textContent = `${model.name} (${model.id})`;
            
            // Seleziona automaticamente il modello definito nel CONFIG principale
            if (window.CONFIG && model.id === window.CONFIG.MODEL) {
                option.selected = true;
            }
            selectDropdown.appendChild(option);
        });
    }

    // 4. Event Listeners per Ricerca e Selezione
    
    // Filtro in tempo reale mentre scrivi
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allModels.filter(m => 
            m.name.toLowerCase().includes(searchTerm) || 
            m.id.toLowerCase().includes(searchTerm)
        );
        renderOptions(filtered);
    });

    // Aggiornamento della variabile CONFIG globale quando cambi modello
    selectDropdown.addEventListener('change', (e) => {
        const selectedModelId = e.target.value;
        if (selectedModelId && window.CONFIG) {
            // Modifica la proprietà MODEL nell'oggetto CONFIG del file script.js
            window.CONFIG.MODEL = selectedModelId;
            
            // Aggiorna visivamente l'indicatore di stato nell'header (opzionale)
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                // Tronca il nome se è troppo lungo per l'interfaccia mobile
                const shortName = selectedModelId.split('/').pop();
                statusIndicator.innerHTML = `Online - <span style="color:#f8fafc; margin-left:4px">${shortName}</span>`;
            }
        }
    });
}

// Avvia lo script una volta caricato
initModelSelector();
