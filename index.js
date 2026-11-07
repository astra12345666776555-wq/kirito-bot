import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import readline from 'readline';

const CONFIG = {
    OWNER_NUMBER: "51947497514",
    PREFIXOS: [".", "!"]
};

// Configurar lector para la consola de Termux por si pide el número para el código de emparejamiento
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let db = { global: {}, grupos: {} };
const dbFile = "database.json";

function cargarDB() {
    try {
        if (fs.existsSync(dbFile)) {
            let data = fs.readFileSync(dbFile, "utf8");
            db = JSON.parse(data);
        }
    } catch (e) {
        console.error("❌ Error al cargar la base de datos:", e);
    }
}

function guardarDB() {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), "utf8");
    } catch (e) {
        console.error("❌ Error al guardar la base de datos:", e);
    }
}

cargarDB();

const plugins = {};
const pluginsDir = path.resolve("plugins");
function cargarPlugins() {
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);
    const archivos = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".js"));
    for (let archivo of archivos) {
        let rutaPlugin = pathToFileURL(path.join(pluginsDir, archivo)).href;
        import(rutaPlugin + "?update=" + Date.now()).then(plugin => {
            const mod = plugin.default || plugin;
            if (mod && mod.name) {
                plugins[mod.name] = mod.run;
                console.log(`[PLUGIN CARGADO] --> ${mod.name}`);
            }
        }).catch(err => {
            console.error(`❌ Error cargando plugin ${archivo}:`, err);
        });
    }
}

console.log("🔄 Cargando plugins...");
cargarPlugins();

function obtenerTagUsuario(jid) {
    if (!jid) return "@usuario";
    let num = jid.split("@")[0];
    return `@${num}`;
}

function formatearMoneda(val) {
    return Number(val || 0).toLocaleString("es-PE");
}

async function connectToWhatsApp() {
    console.log("🔌 Iniciando socket con la carpeta 'sesions'...");
    const { state, saveCreds } = await useMultiFileAuthState("sesions");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Si no hay credenciales guardadas y es un solo teléfono, solicitamos emparejamiento por código numérico de 8 dígitos
    if (!sock.authState.creds.registered) {
        console.log("\n📱 Como tienes un solo teléfono, usaremos el código de vinculación por número.");
        let phoneNumber = await question("👉 Ingresa tu número de WhatsApp con código de país (ej. 51947497514): ");
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

        console.log("⏳ Solicitando código de emparejamiento a WhatsApp...");
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n🔑 TU CÓDIGO DE VINCULACIÓN ES: ${code?.match(/.{1,4}/g)?.join("-") || code}\n`);
                console.log("💡 Ve a WhatsApp > Ajustes > Dispositivos vinculados > Vincular dispositivo > Vincular con el número de teléfono e ingresa este código.");
            } catch (err) {
                console.error("❌ Error al solicitar el código de emparejamiento:", err);
            }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        console.log("📡 [CONEXIÓN UPDATE]:", connection || "actualizando...");

        if (connection === "close") {
            let statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`⚠️ Conexión cerrada. Código de error: ${statusCode}`);
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("🔄 Reconectando automáticamente...");
                setTimeout(connectToWhatsApp, 3000);
            } else {
                console.log("❌ Sesión cerrada por completo.");
            }
        } else if (connection === "open") {
            console.log("¡Kirito Bot conectado exitosamente con tu código!  🚀");
            rl.close();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (let msg of messages) {
            if (!msg.message) continue;
            let chatId = msg.key.remoteJid;
            let senderJid = msg.key.participant || chatId;
            if (msg.key.fromMe) {
                senderJid = CONFIG.OWNER_NUMBER + "@s.whatsapp.net";
            }

            // 🔇 FILTRO GLOBAL DE USUARIOS SILENCIADOS (.mute)
            if (global.mutados && global.mutados[chatId] && global.mutados[chatId][senderJid]) {
                let expira = global.mutados[chatId][senderJid];
                if (Date.now() < expira) {
                    // El usuario está castigado: borramos su mensaje al instante y detenemos su ejecución
                    await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {});
                    continue; 
                } else {
                    // El castigo expiró, lo removemos de la lista negra
                    delete global.mutados[chatId][senderJid];
                }
            }

            let tipoMensaje = Object.keys(msg.message)[0];
            let textoCuerpo = "";

            if (tipoMensaje === "conversation") {
                textoCuerpo = msg.message.conversation;
            } else if (tipoMensaje === "extendedTextMessage") {
                textoCuerpo = msg.message.extendedTextMessage.text;
            } else if (tipoMensaje === "imageMessage") {
                textoCuerpo = msg.message.imageMessage.caption || "";
            } else if (tipoMensaje === "videoMessage") {
                textoCuerpo = msg.message.videoMessage.caption || "";
            }

            let contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
                              msg.message?.imageMessage?.contextInfo ||
                              msg.message?.videoMessage?.contextInfo ||
                              msg.message?.audioMessage?.contextInfo;

            let quotedMsg = contextInfo?.quotedMessage;

            let primerCar = textoCuerpo.trim()[0];
            let esPrefijoValido = CONFIG.PREFIXOS.includes(primerCar);
            let esEmojiReaccion = quotedMsg && /^[🔥👍\s]+$/u.test(textoCuerpo.trim()) && textoCuerpo.trim().length <= 5;

            let comando = "";
            let args = [];
            let prefijoUsado = "";

            if (esEmojiReaccion) {
                comando = textoCuerpo.trim();
            } else if (esPrefijoValido) {
                prefijoUsado = primerCar;
                let partes = textoCuerpo.trim().slice(1).trim().split(/\s+/);
                comando = partes[0] || "";
                args = partes.slice(1);
            } else {
                continue;
            }

            for (let nombrePlugin in plugins) {
                try {
                    await plugins[nombrePlugin](
                        comando,
                        sock,
                        chatId,
                        msg,
                        args,
                        senderJid,
                        prefijoUsado,
                        formatearMoneda,
                        CONFIG,
                        guardarDB,
                        db,
                        obtenerTagUsuario,
                        senderJid
                    );
                } catch (err) {
                    console.error(`❌ Error en plugin ${nombrePlugin}:`, err);
                }
            }
        }
    });
}

connectToWhatsApp();
