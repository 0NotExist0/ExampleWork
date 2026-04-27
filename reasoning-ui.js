/**
 * Modulo UI per la visualizzazione dinamica del ragionamento (Live Stream)
 */

window.ReasoningUI = {
    /**
     * Crea un componente grafico pronto a ricevere dati in tempo reale
     */
    createLiveReasoningBlock: function() {
        // Contenitore principale
        const container = document.createElement('div');
        Object.assign(container.style, {
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '12px',
            fontSize: '0.9em',
            borderLeft: '4px solid #8b5cf6',
            display: 'none' // Nascosto finché l'IA non inizia a pensare
        });

        // Pulsante di interazione
        const toggleBtn = document.createElement('button');
        toggleBtn.innerText = '🧠 Sto pensando...';
        Object.assign(toggleBtn.style, {
            background: 'none', border: 'none', color: '#a78bfa',
            cursor: 'pointer', fontWeight: '600', padding: '0',
            display: 'flex', alignItems: 'center', fontSize: '0.95em',
            outline: 'none', pointerEvents: 'none' // Disabilitato finché non finisce
        });

        // Testo in espansione
        const content = document.createElement('div');
        Object.assign(content.style, {
            display: 'block', // Visibile di default durante lo stream
            marginTop: '10px', color: '#cbd5e1',
            whiteSpace: 'pre-wrap', fontStyle: 'italic'
        });

        // Logica click (attiva solo a fine stream)
        toggleBtn.onclick = () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.innerText = isHidden ? '🧠 Nascondi Ragionamento' : '🧠 Mostra Ragionamento';
        };

        container.appendChild(toggleBtn);
        container.appendChild(content);

        // Restituisce un oggetto "Controller" per gestire questo Prefab UI
        return {
            container: container,
            // Metodo per aggiornare il testo ad ogni frame
            updateText: function(newText) {
                if (container.style.display === 'none') {
                    container.style.display = 'block';
                }
                content.innerText = newText;
            },
            // Metodo da chiamare quando la generazione è terminata
            finish: function() {
                toggleBtn.style.pointerEvents = 'auto'; // Riabilita il click
                content.style.display = 'none'; // Collassa in automatico alla fine
                toggleBtn.innerText = '🧠 Mostra Ragionamento';
            }
        };
    }
};
