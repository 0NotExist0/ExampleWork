/**
 * Componente Selezione Modelli Mobile-Friendly
 */

async function initModelSelector() {
    const header = document.querySelector('header');
    if (!header) return;

    const rootContainer = document.createElement('div');
    rootContainer.id = 'model-menu-root';
    
    const mainTrigger = document.createElement('div');
    mainTrigger.className = 'menu-item';
    mainTrigger.innerHTML = `
        <span>📂 <b>Scegli Modello</b></span>
        <span id="active-model-name" style="color:#60a5fa; font-size:11px; margin: 0 10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100px;">...</span>
        <span class="arrow">▶</span>
    `;
    
    const mainSubmenu = document.createElement('div');
    mainSubmenu.className = 'submenu';
    
    rootContainer.appendChild(mainTrigger);
    rootContainer.appendChild(mainSubmenu);
    header.parentNode.insertBefore(rootContainer, header.nextSibling);

    mainTrigger.onclick = () => {
        mainTrigger.classList.toggle('open');
        // Se apriamo il menu, scrolliamo in cima
        if(mainTrigger.classList.contains('open')) rootContainer.scrollTop = 0;
    };

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        const data = await response.json();
        const allModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
        
        buildHierarchy(allModels, mainSubmenu, mainTrigger);
        
        if (window.CONFIG) updateGlobalUI(window.CONFIG.MODEL);
    } catch (error) {
        mainTrigger.innerHTML = "<span>❌ Errore Caricamento</span>";
    }

    function buildHierarchy(models, container, rootBtn) {
        const tree = {
            "🟢 GRATIS": { "Standard": [], "Reasoning": [] },
            "🟡 PREMIUM": { "Standard": [], "Reasoning": [] }
        };

        models.forEach(m => {
            const isFree = (m.pricing?.prompt === "0" || m.id.includes(':free'));
            const isReasoning = m.id.toLowerCase().includes('r1') || m.id.toLowerCase().includes('reasoning') || m.name.toLowerCase().includes('think');
            const branch = isFree ? "🟢 GRATIS" : "🟡 PREMIUM";
            const leaf = isReasoning ? "Reasoning" : "Standard";
            tree[branch][leaf].push(m);
        });

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
                    
                    modelItem.onclick = (e) => {
                        e.stopPropagation();
                        if (window.CONFIG) {
                            window.CONFIG.MODEL = model.id;
                            updateGlobalUI(model.id);
                        }
                        rootBtn.classList.remove('open'); // Chiude il menu dopo la scelta
                    };
                    subFolderContent.appendChild(modelItem);
                });
            }
        }
    }

    function createFolderNode(label, parent) {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `<span>${label}</span> <span class="arrow">▶</span>`;
        div.onclick = (e) => {
            e.stopPropagation();
            div.classList.toggle('open');
        };
        parent.appendChild(div);
        return div;
    }

    function updateGlobalUI(modelId) {
        const activeNameTag = document.getElementById('active-model-name');
        const statusIndicator = document.querySelector('.status-indicator');
        const shortName = modelId.split('/').pop();
        if (activeNameTag) activeNameTag.innerText = shortName;
        if (statusIndicator) statusIndicator.innerHTML = `Online - <span style="color:#60a5fa">${shortName}</span>`;
    }
}

initModelSelector();
