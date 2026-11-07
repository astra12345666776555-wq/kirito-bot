import fs from 'fs';
import path from 'path';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import { pathToFileURL } from 'url';

const subbotsDir = path.resolve("subbots");
global.activeSubBots = global.activeSubBots || {};

// ── Seguridad: un nombre de sub-bot solo puede ser letras, números, guion y guion bajo ──
const NOMBRE_VALIDO = /^[a-z0-9_-]{1,30}$/;

function nombreSeguro(nombre) {
    return typeof nombre === "string" && NOMBRE_VALIDO.test(nombre);
}

// Devuelve la ruta del sub-bot SOLO si queda dentro de la carpeta "subbots". Si no, null.
function rutaSubbot(nombre) {
    if (!nombreSeguro(nombre)) return null;
    const ruta = path.resolve(subbotsDir, nombre);
    if (path.dirname(ruta) !== subbotsDir) return null;
    return ruta;
}

function listarSubbots() {
    return fs.readdirSync(subbotsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && nombreSeguro(d.name))
        .map(d => d.name)
        .sort();
}

// Acepta un ID de la lista (1, 2, 3...) o un nombre. Devuelve un nombre seguro o null.
function obtenerNombrePorIdOTexto(input) {
    if (!input) return null;
    if (/^\d+$/.test(input)) {
        return listarSubbots()[parseInt(input, 10) - 1] || null;
    }
    const nombre = input.toLowerCase();
    return nombreSeguro(nombre) ? nombre : null;
}

export default {
    name: "subbot",
    run: async (comando, sock, chatId, msg, args, senderJid, prefijoUsado, formatearMoneda, CONFIG, guardarDB, db) => {
        const cmd = (comando || "").toLowerCase();
        if (!["subbot", "sb", "listsubbot", "quitarsub", "encendersub"].includes(cmd)) return;

        const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
        const ownerJid = CONFIG.OWNER_NUMBER + "@s.whatsapp.net";
        const esDueño = senderJid === ownerJid;

        if (!fs.existsSync(subbotsDir)) fs.mkdirSync(subbotsDir);

        // 1. LISTAR (cualquiera puede verlo)
        if (cmd === "listsubbot" || (["subbot", "sb"].includes(cmd) && args[0]?.toLowerCase() === "listar")) {
            const subbots = listarSubbots();
            if (subbots.length === 0) return responder("📂 No hay sub-bots creados todavía.");
            let txt = "🤖 *LISTA DE SUB-BOTS (POR ID):* \n\n";
            subbots.forEach((sb, idx) => {
                const estado = global.activeSubBots[sb] ? "🟢 Conectado/Activo" : "🔴 Apagado";
                txt += `*${idx + 1}.* \`${sb}\` - *${estado}*\n`;
            });
            return responder(txt);
        }

        // Permisos: dueño, o admin del grupo cuando el chat está en modo público
        let tienePermiso = esDueño;
        if (!tienePermiso && chatId.endsWith("@g.us")) {
            const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
            const participants = groupMetadata?.participants || [];
            const esAdminGrupo = participants.find(p => p.id === senderJid)?.admin;
            db.global = db.global || {};
            db.global.comandosPublicos = db.global.comandosPublicos || {};
            const esPublico = db.global.comandosPublicos[chatId] === true;
            if (esAdminGrupo && esPublico) tienePermiso = true;
        }
        if (!tienePermiso) {
            return responder("❌ Solo el dueño o los administradores (cuando el chat está en modo público con `.modo publico`) pueden ejecutar esta acción.");
        }

        // 2. CREAR (.subbot crear <nombre> <numero>)
        if (["subbot", "sb"].includes(cmd) && args[0]?.toLowerCase() === "crear") {
            const nombreSub = args[1]?.toLowerCase();
            const telefonoSub = args[2]?.replace(/[^0-9]/g, "");

            if (!nombreSub || !telefonoSub) {
                return responder(`⚠️ Faltan datos.\n📌 Uso: \`${prefijoUsado}subbot crear <nombre> <número>\``);
            }
            const subPath = rutaSubbot(nombreSub);
            if (!subPath) {
                return responder("❌ Nombre no válido. Usa solo letras minúsculas, números, guion (-) o guion bajo (_), máximo 30 caracteres.");
            }
            if (fs.existsSync(subPath)) return responder(`❌ El sub-bot *${nombreSub}* ya existe.`);

            fs.mkdirSync(subPath);
            const sesionSubPath = path.join(subPath, "sesion");
            fs.mkdirSync(sesionSubPath);
            fs.mkdirSync(path.join(subPath, "plugins"));

            // Copia de los plugins del bot principal (menos este mismo)
            const pluginsOriginales = path.resolve("plugins");
            if (fs.existsSync(pluginsOriginales)) {
                for (const ap of fs.readdirSync(pluginsOriginales)) {
                    if (ap !== "subbot.js") {
                        fs.copyFileSync(path.join(pluginsOriginales, ap), path.join(subPath, "plugins", ap));
                    }
                }
            }

            await responder(`✅ ¡Sub-bot *${nombreSub}* creado!\n\n⏳ Solicitando código de emparejamiento para +${telefonoSub}...`);
            iniciarInstanciaSubBot(nombreSub, telefonoSub, sesionSubPath, sock, chatId);
            return;
        }

        // 3. ENCENDER / VINCULAR (.encendersub <ID o nombre> <numero>)
        if (cmd === "encendersub") {
            const nombreSub = obtenerNombrePorIdOTexto(args[0]);
            const telefonoSub = args[1]?.replace(/[^0-9]/g, "");

            if (!nombreSub || !telefonoSub) {
                return responder(`⚠️ Uso correcto: \`${prefijoUsado}encendersub <ID o Nombre> <número>\``);
            }
            const subPath = rutaSubbot(nombreSub);
            if (!subPath || !fs.existsSync(subPath)) return responder("❌ No se encontró el sub-bot.");

            await responder(`🔄 Encendiendo y solicitando código para *${nombreSub}*...`);
            iniciarInstanciaSubBot(nombreSub, telefonoSub, path.join(subPath, "sesion"), sock, chatId);
            return;
        }

        // 4. QUITAR (.quitarsub <ID o nombre>)
        if (cmd === "quitarsub") {
            const nombreSub = obtenerNombrePorIdOTexto(args[0]);
            if (!nombreSub) {
                return responder(`⚠️ Uso correcto: \`${prefijoUsado}quitarsub <ID o Nombre>\`\nEjemplo: \`${prefijoUsado}quitarsub 1\``);
            }
            const subPath = rutaSubbot(nombreSub);
            if (!subPath || !fs.existsSync(subPath)) return responder("❌ El sub-bot no existe.");

            if (global.activeSubBots[nombreSub]) {
                try { global.activeSubBots[nombreSub].end(undefined); } catch (e) { /* ya estaba cerrado */ }
                delete global.activeSubBots[nombreSub];
            }
            fs.rmSync(subPath, { recursive: true, force: true });
            return responder(`🗑️ El sub-bot *${nombreSub}* fue eliminado correctamente.`);
        }

        // Ayuda general
        let ayuda = `🛠️ *MENÚ DE SUB-BOTS*:\n\n`;
        ayuda += `• \`${prefijoUsado}listsubbot\` - Ver lista con IDs\n`;
        ayuda += `• \`${prefijoUsado}subbot crear <nombre> <núm>\` - Crear nuevo\n`;
        ayuda += `• \`${prefijoUsado}encendersub <ID> <núm>\` - Vincular por ID\n`;
        ayuda += `• \`${prefijoUsado}quitarsub <ID>\` - Borrar sub-bot por ID\n`;
        await responder(ayuda);
    }
};

async function iniciarInstanciaSubBot(nombreSub, phoneNumber, authFolder, mainSock, chatId) {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();
        const subSock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        global.activeSubBots[nombreSub] = subSock;

        if (!subSock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await subSock.requestPairingCode(phoneNumber);
                    const codigoBonito = code?.match(/.{1,4}/g)?.join("-") || code;
                    await mainSock.sendMessage(chatId, {
                        text: `🔑 *CÓDIGO DE VINCULACIÓN PARA [ ${nombreSub.toUpperCase()} ]*:\n\n\`\`\`${codigoBonito}\`\`\`\n\n📌 Ingresa este código en WhatsApp > Dispositivos vinculados > Vincular con número de teléfono.`
                    });
                } catch (err) {
                    await mainSock.sendMessage(chatId, { text: `❌ Error al generar el código para *${nombreSub}*.` }).catch(() => {});
                }
            }, 4000);
        }

        subSock.ev.on("creds.update", saveCreds);

        subSock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    setTimeout(() => iniciarInstanciaSubBot(nombreSub, phoneNumber, authFolder, mainSock, chatId), 5000);
                }
            } else if (connection === "open") {
                await mainSock.sendMessage(chatId, { text: `🚀 ¡El sub-bot *${nombreSub}* se conectó exitosamente a WhatsApp!` }).catch(() => {});
            }
        });

        // Plugins propios del sub-bot
        const pluginsSub = {};
        const pluginsSubDir = path.resolve(subbotsDir, nombreSub, "plugins");
        if (fs.existsSync(pluginsSubDir)) {
            const archivos = fs.readdirSync(pluginsSubDir).filter(f => f.endsWith(".js"));
            for (const archivo of archivos) {
                const rutaPlugin = pathToFileURL(path.join(pluginsSubDir, archivo)).href;
                import(rutaPlugin + "?update=" + Date.now()).then(plugin => {
                    const mod = plugin.default || plugin;
                    if (mod && mod.name) pluginsSub[mod.name] = mod.run;
                }).catch(err => console.error(`[SUBBOT ${nombreSub}] Error cargando ${archivo}:`, err.message));
            }
        }

        subSock.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type !== "notify") return;
            for (const msg of messages) {
                if (!msg.message) continue;
                const cId = msg.key.remoteJid;
                const sJid = msg.key.participant || cId;
                const textoCuerpo = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
                const primerCar = textoCuerpo.trim()[0];
                if (![".", "!"].includes(primerCar)) continue;

                const partes = textoCuerpo.trim().slice(1).trim().split(/\s+/);
                const comando = partes[0] || "";
                const args = partes.slice(1);

                for (const p in pluginsSub) {
                    try {
                        await pluginsSub[p](comando, subSock, cId, msg, args, sJid, primerCar, (v) => v, { OWNER_NUMBER: phoneNumber, PREFIXOS: [".", "!"] }, () => {}, {}, () => "", sJid);
                    } catch (e) {
                        console.error(`[SUBBOT ${nombreSub}] Error en plugin ${p}:`, e.message);
                    }
                }
            }
        });
    } catch (e) {
        console.error(`Error crítico en sub-bot ${nombreSub}:`, e);
    }
}
