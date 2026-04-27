/**
 * Modulo UI per la visualizzazione del ragionamento (Thought Process)
 * Agisce come un componente indipendente collegato all'oggetto globale.
 */

window.ReasoningUI = {
    /**
     * Genera un elemento DOM contenente il ragionamento collassabile
     * @param {string} reasoningText - Il testo del ragionamento dell'IA
     * @returns {HTMLElement} - Il contenitore pronto da iniettare nel DOM
     */
    createReasoningBlock: function(reasoningText) {
        // Contenitore principale (stile pannello)
        const container = document.createElement('div');
        Object.assign(container.style, {
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '12px',
            fontSize: '0.9em',
            borderLeft: '4px solid #8b5cf6' // Viola per distinguere il ragionamento
        });

        // Pulsante di espansione/chiusura
        const toggleBtn = document.createElement('button');
        toggleBtn.innerText = '🧠 Mostra Ragionamento';
        Object.assign(toggleBtn.style, {
            background: 'none',
            border: 'none',
            color: '#a78bfa',
            cursor: 'pointer',
            fontWeight: '600',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.95em',
            outline: 'none'
        });

        // Contenitore del testo vero e proprio
        const content = document.createElement('div');
        content.innerText = reasoningText;
        Object.assign(content.style, {
            display: 'none', // Nascosto di default
            marginTop: '10px',
            color: '#cbd5e1',
            whiteSpace: 'pre-wrap', // Mantiene la formattazione e gli a capo
            fontStyle: 'italic'
        });

        // Logica di toggle (On/Off)
        toggleBtn.onclick = () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.innerText = isHidden ? '🧠 Nascondi Ragionamento' : '🧠 Mostra Ragionamento';
        };

        // Assemblaggio del Prefab DOM
        container.appendChild(toggleBtn);
        container.appendChild(content);
        
        return container;
    }
};
