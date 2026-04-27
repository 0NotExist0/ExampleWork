/**
 * File di Configurazione Globale (Data Container)
 * Isola le API Key e i settaggi principali dal resto della logica.
 */

window.CONFIG = {
    // Sostituisci questa stringa se l'API key dovesse cambiare in futuro
    API_KEY: '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',
    
    // Endpoint universale di OpenRouter
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    
    // Modello caricato di default all'avvio dell'applicazione
    MODEL: 'nvidia/nemotron-4-340b-instruct'
};
