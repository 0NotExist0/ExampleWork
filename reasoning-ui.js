/**
 * Modulo ReasoningUI — Blocco ragionamento collassabile in streaming.
 * Esposto come window.ReasoningUI per essere usato da script.js.
 */

(function () {

    const STYLES = `
        .reasoning-block {
            border-left: 3px solid #374151;
            margin-bottom: 10px;
            border-radius: 6px;
            overflow: hidden;
            background: rgba(55, 65, 81, 0.15);
        }
        .reasoning-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            cursor: pointer;
            user-select: none;
            font-size: 12px;
            color: #9ca3af;
            background: rgba(55, 65, 81, 0.3);
            transition: background 0.2s;
        }
        .reasoning-header:hover {
            background: rgba(55, 65, 81, 0.5);
        }
        .reasoning-header .r-icon {
            font-size: 14px;
            animation: r-pulse 1.2s infinite;
        }
        .reasoning-header .r-icon.done {
            animation: none;
        }
        .reasoning-header .r-arrow {
            margin-left: auto;
            transition: transform 0.25s;
            font-size: 10px;
        }
        .reasoning-block.open .r-arrow {
            transform: rotate(90deg);
        }
        .reasoning-body {
            display: none;
            padding: 10px 14px;
            font-size: 12px;
            color: #9ca3af;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.6;
            max-height: 300px;
            overflow-y: auto;
        }
        .reasoning-block.open .reasoning-body {
            display: block;
        }
        @keyframes r-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
        }
    `;

    // Inietta stili una volta sola
    if (!document.getElementById('reasoning-ui-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'reasoning-ui-styles';
        styleTag.textContent = STYLES;
        document.head.appendChild(styleTag);
    }

    /**
     * Crea un blocco di ragionamento live.
     * Restituisce { container, updateText(text), finish(hasContent) }
     */
    function createLiveReasoningBlock() {
        const container = document.createElement('div');
        container.className = 'reasoning-block'; // chiuso di default

        const header = document.createElement('div');
        header.className = 'reasoning-header';
        header.innerHTML = `
            <span class="r-icon">🧠</span>
            <span class="r-label">Ragionamento in corso...</span>
            <span class="r-arrow">▶</span>
        `;

        const body = document.createElement('div');
        body.className = 'reasoning-body';

        container.appendChild(header);
        container.appendChild(body);

        // Toggle apertura/chiusura
        header.addEventListener('click', () => {
            container.classList.toggle('open');
        });

        function updateText(text) {
            body.textContent = text;
            // Auto-scroll interno al box se aperto
            body.scrollTop = body.scrollHeight;
        }

        function finish(hasContent) {
            const icon = header.querySelector('.r-icon');
            const label = header.querySelector('.r-label');

            if (!hasContent) {
                // Nessun reasoning ricevuto: rimuovi il blocco
                container.remove();
                return;
            }

            icon.classList.add('done');
            icon.textContent = '💡';
            label.textContent = 'Ragionamento (clicca per espandere)';
            // Chiudi dopo lo stream
            container.classList.remove('open');
        }

        return { container, updateText, finish };
    }

    // Esponi globalmente
    window.ReasoningUI = { createLiveReasoningBlock };

    console.log("✅ ReasoningUI caricato.");

})();
