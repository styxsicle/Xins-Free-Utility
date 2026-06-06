// XTweaks AI Client — internal engine wrapper
// Backend: local AI engine via secure IPC. No external network calls.

const XTWEAKS_AI_MODEL = 'llama3.2';

const XTWEAKS_AI_SYSTEM_PROMPT =
    'You are AI Tweaker, the premium assistant inside XTweaks Premium Utility. ' +
    'Help users understand gaming performance, input delay, Fortnite optimization, ' +
    'Windows tweaks, startup apps, CPU/GPU/RAM usage, network issues, and safe system tuning. ' +
    'Be clear, practical, and never claim you applied a tweak unless the app actually performed that action.';

async function aiEngineDetect() {
    try {
        return await window.electronAPI.aiDetect();
    } catch (e) {
        return { running: false, models: [] };
    }
}

async function aiListModels() {
    const result = await aiEngineDetect();
    return result.models || [];
}

async function aiIsModelAvailable(model) {
    const models = await aiListModels();
    return models.some(m => m.name && m.name.startsWith(model));
}

async function aiChat(messages) {
    return await window.electronAPI.aiChat(messages);
}

window.XTweaksAI = {
    XTWEAKS_AI_MODEL,
    XTWEAKS_AI_SYSTEM_PROMPT,
    aiEngineDetect,
    aiListModels,
    aiIsModelAvailable,
    aiChat
};
