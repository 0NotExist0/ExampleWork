/**
 * Modulo UI per la visualizzazione dinamica del ragionamento (Live Stream)
 */

window.ReasoningUI = {
    createLiveReasoningBlock: function() {
        const container = document.createElement('div');
        Object.assign(container.style, {
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '12px',
            fontSize: '0.9em',
            borderLeft: '4px solid #8b5cf6',
            display: 'none' // Nascosto di default, si aprirà al primo byte
        });

        const toggleBtn = document.createElement('button');
        toggleBtn.innerText = '🧠 Avvio ragionamento...';
        Object.assign(toggleBtn.style, {
            background: 'none', border: 'none', color: '#a78bfa',
            cursor: 'default', fontWeight: '600', padding: '0',
            display: 'flex', alignItems: 'center', fontSize: '0.95em',
            outline: 'none', pointerEvents: 'none' // Disabilitato durante lo streaming
        });

        const content = document.createElement('div');
        Object.assign(content.style, {
            display: 'block', 
            marginTop: '10px', color: '#cbd5e1',
            whiteSpace: 'pre-wrap', fontStyle: 'italic'
        });

        toggleBtn.onclick = () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.innerText = isHidden ? '🧠 Nascondi Ragionamento' : '🧠 Mostra Ragionamento';
        };

        container.appendChild(toggleBtn);
        container.appendChild(content);

        return {
            container: container,
            updateText: function(newText) {
                // Seleziona il componente e lo rende visibile al primo carattere ricevuto
                if (container.style.display === 'none' || container.style.display === '') {
                    container.style.display = 'block';
                    toggleBtn.innerText = '🧠 Sto pensando...'; 
                }
                content.innerText = newText;
            },
            finish: function(hasReasoning) {
                // Se alla fine dello stream non c'era nessun ragionamento, nascondi tutto
                if (!hasReasoning) {
                    container.style.display = 'none';
                    return;
                }
                // Altrimenti, abilita il click per l'utente e collassa il blocco
                toggleBtn.style.pointerEvents = 'auto'; 
                toggleBtn.style.cursor = 'pointer';
                content.style.display = 'none'; 
                toggleBtn.innerText = '🧠 Mostra Ragionamento'; 
            }
        };
    }
};
