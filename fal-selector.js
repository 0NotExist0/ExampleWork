/**
 * Script Selezione Modelli FAL.AI: Menu Affiancato per Generazione Media Rapida.
 * Guard anti-duplicato: evita doppia inizializzazione.
 */

if (!window.__falSelectorLoaded) {
    window.__falSelectorLoaded = true;

    function initFalSelector() {
        const header = document.querySelector('header');
        if (!header) return;

        if (document.getElementById('fal-menu-root')) return;

        // --- SETUP UI ---
        const rootContainer = document.createElement('div');
        rootContainer.id = 'fal-menu-root';
        // Aggiungiamo un po' di margine per separarlo dall'altro menu
        rootContainer.style.marginLeft = '10px'; 
        
        const mainTrigger = document.createElement('div');
        mainTrigger.className = 'menu-item';
        mainTrigger.style.borderLeft = '2px solid #f59e0b'; // Colore arancione per distinguerlo
        mainTrigger.innerHTML = `
            <span>⚡ <b>Fal.ai Studio</b></span>
            <span class="arrow">▶</span>
        `;
        
        const mainSubmenu = document.createElement('div');
        mainSubmenu.className = 'submenu';
        
        rootContainer.appendChild(mainTrigger);
        rootContainer.appendChild(mainSubmenu);
        
        // Lo inseriamo nell'header, affianco al menu esistente
        header.parentNode.insertBefore(rootContainer, header.nextSibling);

        mainTrigger.onclick = () => mainTrigger.classList.toggle('open');

        // --- DATI MODELLI FAL.AI (Hardcoded perché Fal non ha un endpoint /models pubblico) ---
        const falApiKey = "aaddb1d0-9510-45bc-be15-fdbcc680e2a5:ada9c9eccfeb42ea93e545d8066ec249";
        
        const tree = {
            "🎨 Immagini (Flux & SD)": [
                { id: "fal-ai/flux-pro/v1.1", name: "Flux 1.1 Pro (Migliore)" },
                { id: "fal-ai/flux/dev", name: "Flux Dev" },
                { id: "fal-ai/flux/schnell", name: "Flux Schnell (Ultra Veloce)" },
                { id: "fal-ai/stable-diffusion-v3-medium", name: "Stable Diffusion V3" }
            ],
            "🎬 Video Generativi": [
                { id: "fal-ai/kling-video/v1.2/text-to-video", name: "Kling Video 1.2" },
                { id: "fal-ai/luma-dream-machine/text-to-video", name: "Luma Dream Machine" },
                { id: "fal-ai/runway-gen3/text-to-video", name: "Runway Gen-3 Alpha" },
                { id: "fal-ai/minimax/video-01", name: "MiniMax Video 01" }
            ],
            "🪄 Edit & Upscale": [
                { id: "fal-ai/flux-pro/v1.1/ultra/redux", name: "Flux Ultra Redux (Stile)" },
                { id: "fal-ai/creative-upscaler", name: "Creative Upscaler (4x)" }
            ]
        };

        // --- RENDERING DELLA GERARCHIA ---
        for (let branch in tree) {
            const branchBtn = createFolderNode(branch, mainSubmenu);
            const branchSub = document.createElement('div');
            branchSub.className = 'submenu';
            mainSubmenu.appendChild(branchSub);

            tree[branch].forEach(model => {
                createModelLeaf(model, branchSub);
            });
        }

        // --- FUNZIONI CREAZIONE NODI ---
        function createFolderNode(label, parent) {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.innerHTML = `<span>${label}</span> <span class="arrow">▶</span>`;
            div.onclick = (e) => { e.stopPropagation(); div.classList.toggle('open'); };
            parent.appendChild(div);
            return div;
        }

        function createModelLeaf(model, parent) {
            const leaf = document.createElement('div');
            leaf.className = 'menu-item model-leaf';
            
            leaf.innerHTML = `<span class="model-name" title="${model.id}">${model.name}</span>`;

            leaf.onclick = (e) => {
                e.stopPropagation();
                
                // Aggiorniamo la configurazione globale per usare FAL.AI
                if (typeof window.CONFIG !== 'undefined') {
                    window.CONFIG.MODEL = model.id;
                    window.CONFIG.PROVIDER = 'fal'; // Flag essenziale per il network script
                    window.CONFIG.FAL_KEY = falApiKey;
                    updateGlobalUI(model.name, true);
                } else {
                    console.error("Oggetto window.CONFIG non trovato.");
                }
                
                mainTrigger.classList.remove('open');
            };

            parent.appendChild(leaf);
        }

        // --- AGGIORNAMENTO UI GLOBALE ---
        function updateGlobalUI(shortName) {
            const activeNameTag = document.getElementById('active-model-name');
            const statusIndicator = document.querySelector('.status-indicator');
            
            // Chiude forzatamente l'altro menu (OpenRouter) se è aperto
            const orTrigger = document.querySelector('#model-menu-root .menu-item');
            if (orTrigger) orTrigger.classList.remove('open');
            
            if (activeNameTag) activeNameTag.innerText = shortName;
            if (statusIndicator) statusIndicator.innerHTML = `Online - <span style="color:#f59e0b">FAL: ${shortName}</span>`;
        }
    }

    initFalSelector();
}
