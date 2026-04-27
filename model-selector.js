/**
 * Script indipendente per il caricamento, la ricerca e la selezione
 * dinamica dei modelli tramite l'API di OpenRouter.
 * ORA CON CATEGORIZZAZIONE AUTOMATICA (Gratis/Premium e Standard/Pensanti).
 */

async function initModelSelector() {
    const header = document.querySelector('header');
    
    // Contenitore UI
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
    searchInput.placeholder = 'Cerca modello (es. nemotron, llama, deepseek...)';
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

    // --- SCARICAMENTO DATI ---
    try {
        selectDropdown.innerHTML = '<option>Scaricamento modelli in corso...</option>';
        
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Errore di rete');
        
        const data = await response.json();
        allModels = data.data;
        
        // Ordine alfabetico di base
        allModels.sort((a, b) => a.id.localeCompare(b.id));
        
        renderOptions(allModels);
    } catch (error) {
        console.error("Errore nel caricamento dei modelli:", error);
        selectDropdown.innerHTML = '<option>Errore nel caricamento dei modelli</option>';
    }

    // --- FUNZIONE DI RENDERING E CATEGORIZZAZIONE ---
    function renderOptions(filteredModels) {
        selectDropdown.innerHTML = ''; 
        
        if (filteredModels.length === 0) {
            selectDropdown.innerHTML = '<option value="">Nessun modello trovato</option>';
            return;
        }

        // 1. Definiamo i nostri "Tab dell'Inventario"
        const categories = {
            freeReasoning: { label: '🟢 GRATIS - Modelli Pensanti (Reasoning)', models: [] },
            freeStandard:  { label: '🟢 GRATIS - Modelli Standard', models: [] },
            paidReasoning: { label: '🟡 PREMIUM - Modelli Pensanti (Reasoning)', models: [] },
            paidStandard:  { label: '🟡 PREMIUM - Modelli Standard', models: [] }
        };

        // 2. Cicliamo i modelli e li smistiamo (Logica di Sorting)
        filteredModels.forEach(model => {
            
            // A) Capire se è gratis
            let isFree = false;
            // OpenRouter invia i prezzi come stringhe (es: "0.0")
            if (model.pricing) {
                const promptPrice = parseFloat(model.pricing.prompt || "0");
                const completionPrice = parseFloat(model.pricing.completion || "0");
                if (promptPrice === 0 && completionPrice === 0) {
                    isFree = true;
                }
            } 
            // Fallback se l'ID finisce con :free
            if (model.id.endsWith(':free')) isFree = true;

            // B) Capire se è un modello che ragiona (Pensante)
            const idLower = model.id.toLowerCase();
            const nameLower = model.name.toLowerCase();
            const isReasoning = 
                idLower.includes('deepseek-r1') || 
                idLower.includes('reasoning') || 
                nameLower.includes('reasoning') || 
                nameLower.includes('think') ||
                idLower.includes('thinking');

            // C) Smistamento nell'oggetto giusto
            if (isFree && isReasoning) {
                categories.freeReasoning.models.push(model);
            } else if (isFree && !isReasoning) {
                categories.freeStandard.models.push(model);
            } else if (!isFree && isReasoning) {
                categories.paidReasoning.models.push(model);
            } else {
                categories.paidStandard.models.push(model);
            }
        });

        // 3. Creiamo l'interfaccia basandoci sulle categorie piene
        Object.values(categories).forEach(category => {
            if (category.models.length > 0) {
                // Genera l'OptGroup (L'intestazione non selezionabile della categoria)
                const optgroup = document.createElement('optgroup');
                optgroup.label = category.label;

                // Genera le Option (I modelli effettivi dentro quella categoria)
                category.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = `${model.name} (${model.id})`;
                    
                    if (window.CONFIG && model.id === window.CONFIG.MODEL) {
                        option.selected = true;
                    }
                    optgroup.appendChild(option);
                });

                selectDropdown.appendChild(optgroup);
            }
        });
    }

    // --- EVENT LISTENERS ---
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        // Filtra tutti i modelli. La funzione renderOptions ricreerà le categorie dinamicamente!
        const filtered = allModels.filter(m => 
            m.name.toLowerCase().includes(searchTerm) || 
            m.id.toLowerCase().includes(searchTerm)
        );
        renderOptions(filtered);
    });

    selectDropdown.addEventListener('change', (e) => {
        const selectedModelId = e.target.value;
        if (selectedModelId && window.CONFIG) {
            window.CONFIG.MODEL = selectedModelId; 
            console.log("Modello cambiato in:", window.CONFIG.MODEL);
            
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                const shortName = selectedModelId.split('/').pop();
                statusIndicator.innerHTML = `Online - <span style="color:#f8fafc; margin-left:4px">${shortName}</span>`;
            }
        }
    });
}

initModelSelector();
