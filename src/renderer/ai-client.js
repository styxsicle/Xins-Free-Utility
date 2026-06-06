// XTweaks AI Client — internal engine wrapper
// Backend: local AI engine via secure IPC. No external network calls.

const XTWEAKS_AI_MODEL = 'llama3.2';

const XTWEAKS_AI_SYSTEM_PROMPT =
    'You are AI Tweaker, the premium assistant inside XTweaks Premium Utility. ' +
    'Help users with gaming performance, input delay, Fortnite optimization, Windows tweaks, ' +
    'startup apps, CPU/GPU/RAM usage, network issues, and safe system tuning. ' +
    'When a [Safe PC Snapshot] is present, use the hardware specs to give specific, tailored recommendations. ' +
    'When [XTweaks Tweak States] is present, treat those values as the source of truth for what is applied: ' +
    'do NOT recommend applying a tweak marked "Already Applied". ' +
    'For tweaks marked "Unknown", say the status could not be confirmed and suggest the user check. ' +
    'For tweaks marked "Not Applied" that are relevant and safe, you may recommend them. ' +
    'Never claim a tweak is on or off unless XTweaks provided that state. ' +
    'Never claim you directly ran a command or applied anything yourself. ' +
    'Never invent permissions or system access not provided by the app. ' +
    'Always let the user confirm before any changes are made.';

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
