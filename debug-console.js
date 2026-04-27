/**
 * Script indipendente per abilitare la console di debug (Eruda) su dispositivi mobile.
 * Da includere solo in fase di sviluppo/test.
 */

function abilitaConsoleMobile() {
    // Evita di creare duplicati se il pulsante esiste già nel DOM
    if (document.getElementById('debug-console-btn')) return;

    // Crea l'elemento pulsante
    const btn = document.createElement('button');
    btn.id = 'debug-console-btn';
    btn.innerText = 'Apri Console';
    
    // Applica gli stili inline per posizionarlo fisso in basso a destra
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '80px', // Sollevato per non sovrapporsi alla chat
        right: '20px',
        zIndex: '99999',
        padding: '12px 16px',
        backgroundColor: '#ef4444', // Colore rosso di avviso
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
        fontWeight: 'bold',
        cursor: 'pointer'
    });

    // Aggiunge il pulsante al corpo della pagina
    document.body.appendChild(btn);

    // Definisce l'azione al click del pulsante
    btn.addEventListener('click', function() {
        // Se Eruda è già inizializzato, mostra solo il pannello
        if (window.eruda) {
            eruda.show();
            return;
        }

        // Modifica il testo per dare feedback visivo durante il caricamento
        btn.innerText = 'Caricamento...';

        // Crea dinamicamente il tag <script> per scaricare Eruda dalla CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/eruda';
        
        // Callback eseguita al termine del download dello script
        script.onload = function () {
            eruda.init(); // Inizializza l'ambiente di debug
            eruda.show(); // Apre il pannello immediatamente
            
            // Aggiorna visivamente il pulsante per indicare che è attivo
            btn.innerText = 'Console Attiva';
            btn.style.backgroundColor = '#10b981'; // Cambia colore in verde
        };
        
        // Aggiunge lo script all'header per innescare la richiesta di rete
        document.head.appendChild(script);
    });
}

// Esegue il metodo non appena questo file viene caricato dal browser
abilitaConsoleMobile();
