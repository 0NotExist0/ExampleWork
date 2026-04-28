// config.js - Gestione configurazione e chiavi tramite LocalStorage

window.CONFIG = {
    // Pesca le chiavi dal browser (se non ci sono, usa stringa vuota)
    API_KEY:    localStorage.getItem('OPENROUTER_KEY') || "",
    HF_API_KEY: localStorage.getItem('HUGGINGFACE_KEY') || "",
    
    OR_API_URL: "https://openrouter.ai/api/v1/chat/completions",
    API_URL:    "https://openrouter.ai/api/v1/chat/completions",
    MODEL:      "nvidia/nemotron-3-super-120b-a12b:free",
    PROVIDER:   "openrouter",
    
    // Questa variabile servirà per scambiare la chiave in base al modello scelto
    _activeKey: localStorage.getItem('OPENROUTER_KEY') || "" 
};

// Funzione chiamata dal bottone HTML per salvare le chiavi
function salvaChiavi() {
    const orKey = document.getElementById('input-or-key').value.trim();
    const hfKey = document.getElementById('input-hf-key').value.trim();
    
    if(orKey) localStorage.setItem('OPENROUTER_KEY', orKey);
    if(hfKey) localStorage.setItem('HUGGINGFACE_KEY', hfKey);
    
    alert("✅ Chiavi salvate in modo sicuro nel tuo browser!");
    location.reload(); // Ricarica per applicare le chiavi
}

// All'avvio, se le chiavi sono già salvate, le mostra oscurate negli input
window.addEventListener('DOMContentLoaded', () => {
    const savedOrKey = localStorage.getItem('OPENROUTER_KEY');
    const savedHfKey = localStorage.getItem('HUGGINGFACE_KEY');
    
    if (savedOrKey) document.getElementById('input-or-key').value = savedOrKey;
    if (savedHfKey) document.getElementById('input-hf-key').value = savedHfKey;
});
