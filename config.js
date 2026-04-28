/**
 * config.js - Inizializzazione configurazione globale
 */
window.CONFIG = {
    // Endpoints
    OR_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    HF_PROXY_URL: '/api/hf-proxy', // Il tuo proxy su Vercel
    
    // Stato Iniziale (Default)
    MODEL: 'google/gemini-2.0-flash-001', 
    PROVIDER: 'openrouter',
    
    // Chiave OpenRouter (dal localStorage)
    API_KEY: localStorage.getItem('OPENROUTER_API_KEY') || '',
    _activeKey: localStorage.getItem('OPENROUTER_API_KEY') || ''
};

/**
 * Funzione per salvare solo la chiave OpenRouter
 */
window.salvaChiavi = function() {
    const orInput = document.getElementById('input-or-key');
    const orKey = orInput ? orInput.value.trim() : "";

    if (orKey) {
        localStorage.setItem('OPENROUTER_API_KEY', orKey);
        window.CONFIG.API_KEY = orKey;
        window.CONFIG._activeKey = orKey;
        alert('✅ Chiave OpenRouter salvata! Ricarico la pagina...');
        location.reload();
    } else {
        alert('⚠️ Inserisci una chiave OpenRouter valida.');
    }
};

// Pre-popola l'input all'avvio
document.addEventListener('DOMContentLoaded', () => {
    const orInput = document.getElementById('input-or-key');
    if (orInput && window.CONFIG.API_KEY) {
        orInput.value = window.CONFIG.API_KEY;
    }
});
