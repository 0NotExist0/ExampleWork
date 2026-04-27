/**
 * Script Selezione Modelli a Sottomenu Nidificati.
 * Struttura: Prezzo -> Tipo (Standard/Reasoning) -> Modelli
 */

async function initModelSelector() {
    const header = document.querySelector('header');
    const container = document.createElement('div');
    container.className = 'nested-menu-container';

    // Tasto principale per aprire il menu
    const mainTrigger = document.createElement('div');
    mainTrigger.className = 'menu-item';
    mainTrigger.innerHTML = `<span>Seleziona Modello</span> <span id="current-model-display">...</span>`;
    container.appendChild(mainTrigger);

    const rootMenu = document.createElement('div');
    rootMenu.className = 'submenu';
    container.appendChild(rootMenu);

    mainTrigger.onclick = () => mainTrigger.classList.toggle('open');

    let allModels = [];

    try {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        const data = await res.json();
        allModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
        renderNestedMenu(allModels, rootMenu);
        updateDisplay(window.CONFIG.MODEL);
    } catch (e) { console.error("Errore caricamento", e); }

    function renderNestedMenu(models, parent) {
        const categories = {
            "Gratis": { "Standard": [], "Reasoning": [] },
            "Premium": { "Standard": [], "Reasoning": [] }
        };

        // Smistamento modelli
        models.forEach(m => {
            const isFree = (m.pricing?.prompt === "0" || m.id.includes(':free'));
            const isReasoning = m.id.toLowerCase().includes('r1') || m.id.toLowerCase().includes('reasoning') || m.name.toLowerCase().includes('think');
            
            const priceKey = isFree ? "Gratis" : "Premium";
            const typeKey = isReasoning ? "Reasoning" : "Standard";
            categories[priceKey][typeKey].push(m);
        });

        // Creazione dei sottomenu (Livello 1: Prezzo)
        for (let price in categories) {
            const priceItem = createMenuItem(price, parent, price === "Gratis" ? "badge-free" : "badge-paid");
            const priceSub = document.createElement('div');
            priceSub.className = 'submenu';
            parent.appendChild(priceSub);

            priceItem.onclick = () => priceItem.classList.toggle('open');

            // Creazione (Livello 2: Tipo)
            for (let type in categories[price]) {
                if (categories[price][type].length === 0) continue;

                const typeItem = createMenuItem(type, priceSub);
                const typeSub = document.createElement('div');
                typeSub.className = 'submenu';
                priceSub.appendChild(typeSub);

                typeItem.onclick = () => typeItem.classList.toggle('open');

                // Creazione (Livello 3: Modelli effettivi)
                categories[price][type].forEach(model => {
                    const modItem = document.createElement('div');
                    modItem.className = 'menu-item model-option';
                    modItem.innerHTML = `<span>${model.name}</span>`;
                    modItem.onclick = () => {
                        selectModel(model.id);
                        // Chiudi tutto il menu dopo la selezione
                        mainTrigger.classList.remove('open');
                    };
                    typeSub.appendChild(modItem);
                });
            }
        }
    }

    function createMenuItem(label, parent, badgeClass = "") {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `<span class="${badgeClass}">${label}</span> <span>▶</span>`;
        parent.appendChild(div);
        return div;
    }

    function selectModel(id) {
        if (!window.CONFIG) return;
        window.CONFIG.MODEL = id;
        updateDisplay(id);
        console.log("Modello attivo:", id);
    }

    function updateDisplay(id) {
        const display = document.getElementById('current-model-display');
        const status = document.querySelector('.status-indicator');
        const name = id.split('/').pop();
        if (display) display.innerText = name;
        if (status) status.innerHTML = `Online - <span style="color:#60a5fa">${name}</span>`;
    }
}

initModelSelector();
