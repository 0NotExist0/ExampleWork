/**
 * Componente Selezione Modelli a Gerarchia Dinamica
 * Livelli: Prezzo -> Tipo -> Nome Modello
 */

async function initModelSelector() {
    const header = document.querySelector('header');
    if (!header) return;

    // 1. Inizializzazione Container Radice
    const rootContainer = document.createElement('div');
    rootContainer.id = 'model-menu-root';
    
    const mainTrigger = document.createElement('div');
    mainTrigger.className = 'menu-item';
    mainTrigger.innerHTML = `
        <span>📂 <b>Catalogo Modelli</b></span>
        <span id="active-model-name" style="color:#60a5fa; font-size:12px; font-weight:bold;">Sincronizzazione...</span>
        <span class="arrow">▶</span>
    `;
    
    const mainSubmenu = document.createElement('div');
    mainSubmenu.className = 'submenu';
    
    rootContainer.appendChild(mainTrigger);
    rootContainer.appendChild(mainSubmenu);
    header.parentNode.insertBefore(rootContainer, header.nextSibling);

    // Gestore apertura/chiusura menu radice
    mainTrigger.onclick = () => mainTrigger.classList.toggle('open');

    // 2. Recupero Dati e Costruzione Albero
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error("Network error");
        
        const data = await response.json();
        const allModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
        
        buildHierarchy(allModels, mainSubmenu, mainTrigger);
        
        // Impostazione iniziale basata su config.js
        if (window.CONFIG) {
            updateGlobalUI(window.CONFIG.MODEL);
        }
    } catch (error) {
        console.error("Errore inizializzazione menu:", error);
        mainTrigger.innerHTML = "<span>❌ Errore nel caricamento dei modelli</span>";
    }

    /**
     * Organizza i modelli in una struttura nidificata
     */
    function buildHierarchy(models, container, rootBtn) {
        const tree = {
            "🟢 Modelli Gratuiti": { "Standard": [], "Pensanti (Reasoning)": [] },
            "🟡 Modelli Premium": { "Standard": [], "Pensanti (Reasoning)": [] }
        };

        // Algoritmo di smistamento (Sorting Logic)
        models.forEach(m => {
            const isFree = (m.pricing?.prompt === "0" || m.id.includes(':free'));
            const isReasoning = m.id.toLowerCase().includes('r1') || 
                               m.id.toLowerCase().includes('reasoning') || 
                               m.name.toLowerCase().includes('think');
            
            const branch = isFree ? "🟢 Modelli Gratuiti" : "🟡 Modelli Premium";
            const leaf = isReasoning ? "Pensanti (Reasoning)" : "Standard";
            tree[branch][leaf].push(m);
        });

        // Generazione fisica degli elementi DOM
        for (let folderName in tree) {
            const folderBtn = createFolderNode(folderName, container);
            const folderContent = document.createElement('div');
            folderContent.className = 'submenu';
            container.appendChild(folderContent);

            for (let subFolderName in tree[folderName]) {
                const modelList = tree[folderName][subFolderName];
                if (modelList.length === 0) continue;

                const subFolderBtn = createFolderNode(subFolderName, folderContent);
                const subFolderContent = document.createElement('div');
                subFolderContent.className = 'submenu';
                folderContent.appendChild(subFolderContent);

                modelList.forEach(model => {
                    const modelItem = document.createElement('div');
                    modelItem.className = 'model-leaf';
                    modelItem.innerText = model.name;
                    
                    modelItem.onclick = (event) => {
                        event.stopPropagation(); // Impedisce la chiusura dei folder superiori
                        
                        // Aggiorna variabile globale e chiude il menu principale
                        if (window.CONFIG) {
                            window.CONFIG.MODEL = model.id;
                            updateGlobalUI(model.id);
                        }
                        rootBtn.classList.remove('open');
                    };
                    subFolderContent.appendChild(modelItem);
                });
            }
        }
    }

    /**
     * Helper per creare una cartella cliccabile
     */
    function createFolderNode(label, parent) {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `<span>${label}</span> <span class="arrow">▶</span>`;
        
        div.onclick = (event) => {
            event.stopPropagation();
            div.classList.toggle('open');
        };
        
        parent.appendChild(div);
        return div;
    }

    /**
     * Sincronizza l'interfaccia con il modello selezionato
     */
    function updateGlobalUI(modelId) {
        const activeNameTag = document.getElementById('active-model-name');
        const statusIndicator = document.querySelector('.status-indicator');
        const shortName = modelId.split('/').pop();

        if (activeNameTag) activeNameTag.innerText = shortName;
        if (statusIndicator) {
            statusIndicator.innerHTML = `Online - <span style="color:#60a5fa">${shortName}</span>`;
        }
        console.log("🚀 Motore sincronizzato su modello:", modelId);
    }
}

// Esecuzione immediata
initModelSelector();
