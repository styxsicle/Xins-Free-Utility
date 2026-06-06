const XTWEAKS_AI_MODEL = 'llama3.2';

const XTWEAKS_AI_SYSTEM_PROMPT =
    'You are AI Tweaker, a local assistant inside XTweaks Premium Utility. ' +
    'Help users understand gaming performance, input delay, Fortnite optimization, ' +
    'Windows tweaks, startup apps, CPU/GPU/RAM usage, network issues, and safe system tuning. ' +
    'Be clear, practical, and never pretend to perform actions you cannot actually do.';

async function detectOllama() {
    try {
        return await window.electronAPI.ollamaDetect();
    } catch (e) {
        return { running: false, models: [] };
    }
}

async function listOllamaModels() {
    const result = await detectOllama();
    return result.models || [];
}

async function isModelAvailable(model) {
    const models = await listOllamaModels();
    return models.some(m => m.name && m.name.startsWith(model));
}

async function chatWithOllama(messages) {
    return await window.electronAPI.ollamaChat(messages);
}

window.OllamaClient = {
    XTWEAKS_AI_MODEL,
    XTWEAKS_AI_SYSTEM_PROMPT,
    detectOllama,
    listOllamaModels,
    isModelAvailable,
    chatWithOllama
};
