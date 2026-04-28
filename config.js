// Configurazione globale
// ATTENZIONE: Non inserire mai i token reali direttamente nel codice sorgente!
// Utilizza file .env o un backend per gestire le chiavi API in sicurezza.

window.CONFIG = {
    API_KEY:    "", // Rimosso per sicurezza: carica questo valore da una variabile d'ambiente
    HF_API_KEY: "", // Rimosso per sicurezza: carica questo valore da una variabile d'ambiente
    OR_API_URL: "https://openrouter.ai/api/v1/chat/completions",
    API_URL:    "https://openrouter.ai/api/v1/chat/completions",
    MODEL:      "nvidia/nemotron-3-super-120b-a12b:free",
    PROVIDER:   "openrouter"
};
