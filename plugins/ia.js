const SYSTEM = "Eres un asistente dentro de un bot de WhatsApp. Responde en español, de forma breve y clara.";
const TIMEOUT = 20000;

// Proveedores compatibles con formato OpenAI
const openaiCompat = (url, key, model, extraHeaders = {}) => async (pregunta) => {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...extraHeaders },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: pregunta }
            ]
        }),
        signal: AbortSignal.timeout(TIMEOUT)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const texto = data?.choices?.[0]?.message?.content;
    if (!texto) throw new Error("Respuesta vacía");
    return texto;
};

const gemini = (key) => async (pregunta) => {
    const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM }] },
                contents: [{ role: "user", parts: [{ text: pregunta }] }]
            }),
            signal: AbortSignal.timeout(TIMEOUT)
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const texto = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("");
    if (!texto) throw new Error("Respuesta vacía");
    return texto;
};

// Sin key, último recurso
const pollinations = async (pregunta) => {
    const res = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "openai",
            messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: pregunta }
            ]
        }),
        signal: AbortSignal.timeout(TIMEOUT)
    });
    const data = await res.json();
    const texto = data?.choices?.[0]?.message?.content;
    if (!res.ok || !texto) throw new Error(`HTTP ${res.status}`);
    return texto;
};

function obtenerProveedores() {
    const p = [];
    const e = process.env;
    if (e.GEMINI_API_KEY) p.push({ nombre: "Gemini", fn: gemini(e.GEMINI_API_KEY) });
    if (e.GROQ_API_KEY) p.push({
        nombre: "Groq",
        fn: openaiCompat("https://api.groq.com/openai/v1/chat/completions", e.GROQ_API_KEY, "llama-3.3-70b-versatile")
    });
    if (e.OPENROUTER_API_KEY) p.push({
        nombre: "OpenRouter",
        fn: openaiCompat("https://openrouter.ai/api/v1/chat/completions", e.OPENROUTER_API_KEY, "meta-llama/llama-3.3-70b-instruct:free")
    });
    p.push({ nombre: "Pollinations", fn: pollinations });
    return p;
}

async function preguntarIA(pregunta) {
    for (const prov of obtenerProveedores()) {
        try {
            const respuesta = await prov.fn(pregunta);
            console.log(`🤖 IA respondió con: ${prov.nombre}`);
            return respuesta;
        } catch (err) {
            console.error(`⚠️ ${prov.nombre} falló: ${err.message}`);
        }
    }
    throw new Error("Todos los proveedores fallaron");
}

export default {
    name: "ia",
    run: async (comando, sock, chatId, msg, args) => {
        if (!["ia", "ai", "gemini"].includes(comando.toLowerCase())) return;

        let pregunta = args.join(" ").trim();
        const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!pregunta && citado) {
            pregunta = citado.conversation || citado.extendedTextMessage?.text || "";
        }
        if (!pregunta) {
            return sock.sendMessage(chatId, { text: "✦ Escribe tu pregunta.\nEjemplo: .ia cuál es la capital de Francia?" }, { quoted: msg });
        }

        try {
            await sock.sendPresenceUpdate("composing", chatId);
            const respuesta = await preguntarIA(pregunta);
            await sock.sendMessage(chatId, { text: `✦ ${respuesta}` }, { quoted: msg });
        } catch (err) {
            console.error("❌ Error en IA:", err.message);
            await sock.sendMessage(chatId, { text: "❌ Ninguna IA pudo responder ahora. Intenta en unos minutos." }, { quoted: msg });
        }
    }
};
