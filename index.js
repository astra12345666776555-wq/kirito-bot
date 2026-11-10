import {
    makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore, normalizeMessageContent, getContentType
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import readline from 'readline';

const CONFIG = {
    OWNER_NUMBER: "51947497514",
    PREFIXOS: [".", "!"]
};

const logger = pino({ level: 'silent' });
const INICIO = Date.now();
const soloDigitos = (s) => String(s || "").replace(/[^0-9]/g, "");
const OWNER_JID = CONFIG.OWNER_NUMBER + "@s.whatsapp.net";

// ============================================================
// 🛡️ Un error suelto NUNCA debe tumbar el bot
// ============================================================
process.on('uncaughtException', (e) => console.error("⚠️ uncaughtException:", e?.stack || e));
process.on('unhandledRejection', (e) => console.error("⚠️ unhandledRejection:", e?.stack || e));

// ============================================================
// 💾 Base de datos (carga segura + guardado atómico con debounce)
// ============================================================
let db = { global: {}, grupos: {} };
const dbFile = "database.json";

function cargarDB() {
    try {
        if (fs.existsSync(dbFile)) {
            db = JSON.parse(fs.readFileSync(dbFile, "utf8"));
        }
    } catch (e) {
        // Si el archivo está dañado NO lo pisamos: guardamos copia y arrancamos limpio
        const copia = `database.corrupta-${Date.now()}.json`;
        try { fs.copyFileSync(dbFile, copia); } catch {}
        console.error(`❌ database.json dañada. Copia guardada en ${copia}. Empiezo con una base limpia.`);
        db = { global: {}, grupos: {} };
    }
    if (!db || typeof db !== "object") db = {};
    db.global ||= {};
    db.grupos ||= {};
}

// Reemplazo seguro para guardar la DB: ignora temporizadores y referencias circulares
function crearReemplazoDB() {
    const ancestros = [];
    if (!global.__dbAvisos) global.__dbAvisos = new Set();
    const avisados = global.__dbAvisos;
    return function (clave, valor) {
        if (valor === null || typeof valor !== "object") return valor;
        const nombre = valor.constructor && valor.constructor.name;
        if (nombre === "Timeout" || nombre === "Immediate" || nombre === "TimersList") {
            if (!avisados.has(clave)) {
                avisados.add(clave);
                console.log('[DB] ⚠️ Temporizador ignorado al guardar, propiedad "' + clave + '"');
            }
            return undefined;
        }
        while (ancestros.length > 0 && ancestros[ancestros.length - 1] !== this) ancestros.pop();
        if (ancestros.includes(valor)) return undefined;
        ancestros.push(valor);
        return valor;
    };
}

let dbTimer = null;
function guardarDBYa() {
    if (dbTimer) { clearTimeout(dbTimer); dbTimer = null; }
    try {
        fs.writeFileSync(dbFile + ".tmp", JSON.stringify(db, crearReemplazoDB(), 2), "utf8");
        fs.renameSync(dbFile + ".tmp", dbFile);
    } catch (e) {
        console.error("❌ Error al guardar la base de datos:", e);
    }
}
// Los plugins la llaman como siempre: guardarDB()
function guardarDB() {
    if (dbTimer) return;
    dbTimer = setTimeout(guardarDBYa, 800);
}

cargarDB();
for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => { guardarDBYa(); process.exit(0); });
}

// ============================================================
// 🔌 Plugins (se cargan ANTES de conectar y se recargan solos al editarlos)
// ============================================================
const plugins = {};          // nombre -> run
const archivoANombre = {};   // archivo -> nombre
const erroresPlugins = {};   // archivo -> error
const hooks = {};            // nombre -> { onMessage, onParticipants }  (moderación, antilink, etc.)
global.mutados ||= {};       // { chatId: { jid: timestampExpira } } usado por .mute y .adv
const pluginsDir = path.resolve("plugins");

async function cargarPlugin(archivo) {
    const ruta = path.join(pluginsDir, archivo);
    try {
        if (!fs.existsSync(ruta)) { // archivo borrado
            if (archivoANombre[archivo]) { delete plugins[archivoANombre[archivo]]; delete hooks[archivoANombre[archivo]]; }
            delete archivoANombre[archivo]; delete erroresPlugins[archivo];
            return;
        }
        const plugin = await import(pathToFileURL(ruta).href + "?update=" + Date.now());
        const mod = plugin.default || plugin;
        const run = typeof mod === "function" ? mod : mod?.run;
        if (typeof run !== "function") throw new Error("el plugin no exporta una función 'run'");
        const nombre = mod.name || archivo.replace(/\.js$/, "");
        if (archivoANombre[archivo] && archivoANombre[archivo] !== nombre) { delete plugins[archivoANombre[archivo]]; delete hooks[archivoANombre[archivo]]; }
        if (plugins[nombre] && !Object.values(archivoANombre).includes(nombre)) {
            console.warn(`⚠️ El plugin "${nombre}" de ${archivo} pisa a otro con el mismo nombre.`);
        }
        plugins[nombre] = run;
        // Hooks opcionales: un plugin puede revisar TODOS los mensajes (no solo comandos)
        if (typeof mod.onMessage === "function" || typeof mod.onParticipants === "function") {
            hooks[nombre] = { onMessage: mod.onMessage, onParticipants: mod.onParticipants };
        } else delete hooks[nombre];
        archivoANombre[archivo] = nombre;
        delete erroresPlugins[archivo];
        console.log(`[PLUGIN CARGADO] --> ${nombre}`);
    } catch (err) {
        erroresPlugins[archivo] = err.message;
        console.error(`❌ Error cargando plugin ${archivo}:`, err.message);
    }
}

async function cargarPlugins() {
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);
    const archivos = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".js"));
    await Promise.all(archivos.map(cargarPlugin));
    // Recarga en caliente: editas un plugin y se actualiza solo, sin reiniciar
    try {
        const pendientes = {};
        fs.watch(pluginsDir, (_, archivo) => {
            if (!archivo || !archivo.endsWith(".js")) return;
            clearTimeout(pendientes[archivo]);
            pendientes[archivo] = setTimeout(() => cargarPlugin(archivo), 400);
        });
    } catch { /* fs.watch no disponible: no pasa nada */ }
}

console.log("🔄 Cargando plugins...");
await cargarPlugins();
console.log(`✅ ${Object.keys(plugins).length} plugin(s) listo(s).`);

// ============================================================
// 🧰 Utilidades que reciben los plugins (igual que antes)
// ============================================================
function obtenerTagUsuario(jid) {
    if (!jid) return "@usuario";
    return `@${String(jid).split("@")[0].split(":")[0]}`;
}

function formatearMoneda(val) {
    return Number(val || 0).toLocaleString("es-PE");
}

async function preguntar(texto) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const r = await new Promise((resolve) => rl.question(texto, resolve));
    rl.close();
    return r;
}

// ============================================================
// 📩 Procesamiento de mensajes
// ============================================================
const enviadosPorElBot = new Set();   // ids de mis propios mensajes (anti-bucle)
const yaProcesados = new Set();       // anti-duplicados
const recordar = (set, id, max = 800) => {
    set.add(id);
    if (set.size > max) set.delete(set.values().next().value);
};
const lidEsDueno = new Map();

async function esElDueno(sock, msg, senderJid) {
    if (msg.key.fromMe) return true;
    const candidatos = [msg.key.participantAlt, msg.key.remoteJidAlt, senderJid];
    if (candidatos.some(j => j && soloDigitos(String(j).split("@")[0]) === CONFIG.OWNER_NUMBER)) return true;
    // Los grupos modernos usan LID (un id que no es tu número): lo traducimos
    if (String(senderJid).endsWith("@lid")) {
        if (lidEsDueno.has(senderJid)) return lidEsDueno.get(senderJid);
        try {
            const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(senderJid);
            const res = !!pn && soloDigitos(String(pn).split("@")[0].split(":")[0]) === CONFIG.OWNER_NUMBER;
            lidEsDueno.set(senderJid, res);
            return res;
        } catch { return false; }
    }
    return false;
}

// Recordamos los ids de lo que envía el bot para no reaccionar a sus propios mensajes
function protegerEnvio(sock) {
    const enviarOriginal = sock.sendMessage.bind(sock);
    sock.sendMessage = async (...a) => {
        const r = await enviarOriginal(...a);
        if (r?.key?.id) recordar(enviadosPorElBot, r.key.id);
        return r;
    };
}

async function procesarMensaje(sock, msg) {
    if (!msg?.message || !msg.key?.remoteJid) return;
    const chatId = msg.key.remoteJid;
    if (chatId === "status@broadcast" || chatId.endsWith("@newsletter")) return;

    // Anti-bucle y anti-duplicados
    const idMsg = msg.key.id;
    if (idMsg) {
        if (enviadosPorElBot.has(idMsg) || yaProcesados.has(idMsg)) return;
        recordar(yaProcesados, idMsg);
    }
    // Ignorar mensajes viejos que llegan al reconectar
    const ts = Number(msg.messageTimestamp?.low ?? msg.messageTimestamp ?? 0) * 1000;
    if (ts && ts < INICIO - 60_000) return;

    // 🔧 Quita envolturas (mensajes temporales, ver una vez, etc.) y claves extra
    const contenido = normalizeMessageContent(msg.message);
    if (!contenido) return;
    msg.message = contenido;

    const esGrupo = chatId.endsWith("@g.us");
    let senderJid = msg.key.participant || chatId;
    const dueno = await esElDueno(sock, msg, senderJid);
    if (dueno) senderJid = OWNER_JID;   // así los plugins reconocen al dueño aunque llegue como LID

    // 🔇 FILTRO GLOBAL DE USUARIOS SILENCIADOS (.mute)
    if (global.mutados && global.mutados[chatId] && global.mutados[chatId][senderJid]) {
        let expira = global.mutados[chatId][senderJid];
        if (Date.now() < expira) {
            await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {});
            return;
        } else {
            delete global.mutados[chatId][senderJid];
        }
    }

    // 🔧 Tipo y texto leídos de forma correcta (no por la primera clave del objeto)
    const tipoMensaje = getContentType(contenido);
    const cuerpo = contenido[tipoMensaje];
    const textoCuerpo = String(
        contenido.conversation || cuerpo?.text || cuerpo?.caption ||
        cuerpo?.selectedButtonId || cuerpo?.selectedId || cuerpo?.singleSelectReply?.selectedRowId || ""
    );

    const contextInfo = cuerpo?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    // 🛡️ MODERACIÓN: los plugins con onMessage revisan TODOS los mensajes de grupo
    // (links, spam, palabrotas...). Si devuelven true, el mensaje ya fue tratado y se corta aquí.
    if (esGrupo && !msg.key.fromMe) {
        const infoMod = { sock, msg, chatId, senderJid, texto: textoCuerpo, contenido, tipo: tipoMensaje, esDueno: dueno, db, guardarDB, CONFIG };
        for (const [nombreHook, h] of Object.entries(hooks)) {
            if (!h.onMessage) continue;
            try { if (await h.onMessage(infoMod)) return; }
            catch (err) { console.error(`❌ Error en hook ${nombreHook}:`, err); }
        }
    }

    const limpio = textoCuerpo.trim();
    const primerCar = limpio[0];
    const esPrefijoValido = CONFIG.PREFIXOS.includes(primerCar);
    const esEmojiReaccion = quotedMsg && /^[🔥👍\s]+$/u.test(limpio) && limpio.length <= 5;

    let comando = "";
    let args = [];
    let prefijoUsado = "";

    if (esEmojiReaccion) {
        comando = limpio;
    } else if (esPrefijoValido) {
        prefijoUsado = primerCar;
        const partes = limpio.slice(1).trim().split(/\s+/);
        comando = partes[0] || "";
        args = partes.slice(1);
        if (!comando) return;
    } else {
        return;
    }

    // 🩺 Comando de diagnóstico integrado (solo dueño): .diag
    if (comando.toLowerCase() === "diag" && dueno) {
        const errores = Object.entries(erroresPlugins).map(([a, e]) => `• ${a}: ${e}`).join("\n") || "ninguno";
        await sock.sendMessage(chatId, { text:
            `🩺 *Diagnóstico*\n\n⏱️ Activo: ${Math.round(process.uptime() / 60)} min\n🧠 RAM: ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB\n` +
            `🟢 Node ${process.version}\n🔌 Plugins (${Object.keys(plugins).length}): ${Object.keys(plugins).join(", ")}\n❌ Errores de carga:\n${errores}` }, { quoted: msg });
        return;
    }

    const extra = { esGrupo, esDueno: dueno, texto: textoCuerpo, tipo: tipoMensaje };

    // Todos los plugins en paralelo: uno lento (una descarga, una búsqueda) ya no bloquea a los demás
    await Promise.all(Object.entries(plugins).map(async ([nombrePlugin, run]) => {
        try {
            await run(
                comando, sock, chatId, msg, args, senderJid, prefijoUsado,
                formatearMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, extra
            );
        } catch (err) {
            console.error(`❌ Error en plugin ${nombrePlugin}:`, err);
        }
    }));
}

// ============================================================
// 🔌 Conexión
// ============================================================
let conectando = false;
let intentos = 0;
let numeroVinculacion = null;

async function connectToWhatsApp() {
    if (conectando) return;
    conectando = true;
    try {
        console.log("🔌 Iniciando socket con la carpeta 'sesions'...");
        const { state, saveCreds } = await useMultiFileAuthState("sesions");
        const v = await fetchLatestBaileysVersion().catch(() => null);

        // Si no hay sesión: pedimos el número ANTES de conectar (así no se vence nada mientras escribes)
        if (!state.creds.registered && !numeroVinculacion) {
            console.log("\n📱 Vamos a vincular con código (no necesitas escanear QR).");
            numeroVinculacion = soloDigitos(await preguntar("👉 Ingresa tu número de WhatsApp con código de país (ej. 51947497514): "));
        }

        const sock = makeWASocket({
            ...(v?.version ? { version: v.version } : {}),
            logger,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            markOnlineOnConnect: false,      // no te quita las notificaciones del celular
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            getMessage: async () => undefined
        });

        protegerEnvio(sock);

        if (!state.creds.registered) {
            console.log("⏳ Solicitando código de emparejamiento a WhatsApp...");
            let pedido = 0;
            const pedirCodigo = async () => {
                try {
                    const code = await sock.requestPairingCode(numeroVinculacion);
                    console.log(`\n🔑 TU CÓDIGO DE VINCULACIÓN ES: ${code?.match(/.{1,4}/g)?.join("-") || code}\n`);
                    console.log("💡 WhatsApp > Ajustes > Dispositivos vinculados > Vincular dispositivo > Vincular con el número de teléfono.");
                } catch (err) {
                    if (++pedido < 3) setTimeout(pedirCodigo, 3000);
                    else console.error("❌ No pude obtener el código de emparejamiento:", err?.message || err);
                }
            };
            setTimeout(pedirCodigo, 3000);
        }

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect } = update;
            if (connection) console.log("📡 [CONEXIÓN UPDATE]:", connection);

            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Conexión cerrada. Código: ${statusCode}`);
                try { sock.ev.removeAllListeners(); } catch {}
                conectando = false;

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Cerraste la sesión desde el celular. Borra la carpeta con:  rm -rf sesions  y vuelve a iniciar.");
                    return;
                }
                if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log("❌ Esta sesión se abrió en OTRO lugar (¿dos bots corriendo a la vez?). Cierra el otro y vuelve a iniciar.");
                    return;
                }
                const espera = statusCode === DisconnectReason.restartRequired ? 500 : Math.min(30000, 3000 * (++intentos));
                console.log(`🔄 Reconectando en ${Math.round(espera / 1000)}s...`);
                setTimeout(connectToWhatsApp, espera);
            } else if (connection === "open") {
                intentos = 0;
                console.log("¡Kirito Bot conectado exitosamente con tu código!  🚀");
            }
        });

        // 👥 Entradas/salidas de grupo (para que un ban siga valiendo si el usuario vuelve a entrar)
        sock.ev.on("group-participants.update", (ev) => {
            for (const [nombreHook, h] of Object.entries(hooks)) {
                if (!h.onParticipants) continue;
                Promise.resolve(h.onParticipants({ sock, ev, db, guardarDB, CONFIG }))
                    .catch((err) => console.error(`❌ Error en hook ${nombreHook}:`, err));
            }
        });

        sock.ev.on("messages.upsert", ({ messages, type }) => {
            if (type !== "notify") return;
            // Sin 'await': cada mensaje se procesa por su cuenta y un error no afecta a los demás
            for (const msg of messages) {
                procesarMensaje(sock, msg).catch((e) => console.error("❌ Error procesando mensaje:", e));
            }
        });
    } catch (e) {
        console.error("❌ Falló el inicio de conexión:", e?.message || e);
        conectando = false;
        setTimeout(connectToWhatsApp, Math.min(30000, 3000 * (++intentos)));
    }
}

connectToWhatsApp();
