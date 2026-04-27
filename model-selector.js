/**
 * Script indipendente per il caricamento, la ricerca e la selezione
 * dinamica dei modelli. Sovrascrive la variabile del main script.
 */

async function initModelSelector() {
    const header = document.querySelector('header');
    
    const selectorContainer = document.createElement('div');
    Object.assign(selectorContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '15px 20px',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderBottom: '1px solid #334155'
    });

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

    selectorContainer.appendChild(searchInput);
    selectorContainer.appendChild(selectDropdown);
    header.parentNode.insertBefore(selectorContainer, header.nextSibling);

    let allModels = [];
    try {
        selectDropdown.innerHTML = '<option>Scaricamento modelli in corso...</option>';
        
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Errore di rete');
        
        const data = await response.json();
        allModels = data.data;
        allModels.sort((a, b) => a.id.localeCompare(b.id));
        
        renderOptions(allModels);
    } catch (error) {
        console.error("Errore nel caricamento dei modelli:", error);
        selectDropdown.innerHTML = '<option>Errore nel caricamento dei modelli</option>';
    }

    function renderOptions(filteredModels) {
        selectDropdown.innerHTML = ''; 
        
        if (filteredModels.length === 0) {
            selectDropdown.innerHTML = '<option value="">Nessun modello trovato</option>';
            return;
        }
        
        filteredModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.name} (${model.id})`;
            
            // Verifica la variabile globale per selezionare quello attuale di default
            if (window.CONFIG && model.id === window.CONFIG.MODEL) {
                option.selected = true;
            }
            selectDropdown.appendChild(option);
        });
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allModels.filter(m => 
            m.name.toLowerCase().includes(searchTerm) || 
            m.id.toLowerCase().includes(searchTerm)
        );
        renderOptions(filtered);
    });

    // EVENTO CHIAVE: Quando l'utente seleziona un modello diverso dalla tendina
    selectDropdown.addEventListener('change', (e) => {
        const selectedModelId = e.target.value;
        if (selectedModelId && window.CONFIG) {
            
            // SOSTITUZIONE: Qui il secondo script entra nel primo e cambia il modello
            window.CONFIG.MODEL = selectedModelId; 
            
            // Log di conferma visualizzabile nella console di Eruda
            console.log("SUCCESSO: Modello sostituito nel main script. Nuovo target API ->", window.CONFIG.MODEL);
            
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                const shortName = selectedModelId.split('/').pop();
                statusIndicator.innerHTML = `Online - <span style="color:#f8fafc; margin-left:4px">${shortName}</span>`;
            }
        }
    });
}

initModelSelector();
