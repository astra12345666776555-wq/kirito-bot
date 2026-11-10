import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

// ───────────── Plantillas preestablecidas (siempre DESACTIVADAS al inicio) ─────────────
const PLANTILLAS = {
    welcome: {
        activo: false,
        mensaje:
            "❀ ¡*Bienvenido* a {grupo}!\n\t» {user}\n\nYa somos *{total}* miembros 🎉\nDisfruta del grupo y respeta las reglas.\n\n> ✐ Usa *{prefijo}help* para ver la lista de comandos.\n> 🜸 https://chat.whatsapp.com/H4z3y300pZWKpqcrgjH609?s=cl&p=a&mlu=4&iam=2",
        imagenUrl: ""
    },
    bye: {
        activo: false,
        mensaje: "👋 *{user}* salió de {grupo}.\nQuedamos *{total}* miembros. ¡Suerte!",
        imagenUrl: ""
    }
};

const IMG_POR_DEFECTO = "menu.jpg"; // se usa solo si el archivo existe

const clonar = (o) => JSON.parse(JSON.stringify(o));
const soloNum = (v) => String(v || "").replace(/[^0-9]/g, "");
const jidDe = (p) => (typeof p === "string" ? p : p?.phoneNumber || p?.id || "");

function initGrupo(db, chatId) {
    if (!db.grupos) db.grupos = {};
    if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
    const g = db.grupos[chatId];
    if (!g.welcomeConfig) g.welcomeConfig = clonar(PLANTILLAS.welcome);
    if (!g.byeConfig) g.byeConfig = clonar(PLANTILLAS.bye);
    return g;
}

function armarTexto(plantilla, { user, grupo, total, prefijo }) {
    return plantilla
        .replaceAll("{user}", user)
        .replaceAll("{grupo}", grupo)
        .replaceAll("{total}", String(total))
        .replaceAll("{prefijo}", prefijo);
}

function fuenteImagen(ruta) {
    const candidata = ruta || IMG_POR_DEFECTO;
    try {
        return fs.existsSync(candidata) ? fs.readFileSync(candidata) : null;
    } catch { return null; }
}

function desenvolver(message = {}) {
    let m = message;
    for (let i = 0; i < 4; i++) {
        const inner =
            m?.ephemeralMessage?.message ||
            m?.viewOnceMessage?.message ||
            m?.viewOnceMessageV2?.message ||
            m?.documentWithCaptionMessage?.message;
        if (!inner) break;
        m = inner;
    }
    return m || {};
}

function obtenerImagen(msg) {
    const contenido = desenvolver(msg.message);
    if (contenido.imageMessage) return contenido.imageMessage;
    const ctx =
        contenido.extendedTextMessage?.contextInfo ||
        contenido.imageMessage?.contextInfo;
    const citado = desenvolver(ctx?.quotedMessage);
    return citado.imageMessage || null;
}

// ───────────── Hook: alguien entra o sale del grupo (lo llama tu index) ─────────────
async function onParticipants({ sock, ev, db, CONFIG }) {
    try {
        const { id: chatId, participants, action } = ev || {};
        if (!chatId?.endsWith("@g.us")) return;
        if (!["add", "remove"].includes(action)) return;

        const g = db.grupos?.[chatId];
        if (!g) return; // nunca configurado = desactivado

        const cfg = action === "add" ? g.welcomeConfig : g.byeConfig;
        if (!cfg?.activo) return;

        const metadata = await sock.groupMetadata(chatId).catch(() => null);
        const nombreGrupo = metadata?.subject || "el grupo";
        const total = metadata?.participants?.length || 0;
        const prefijo = CONFIG?.PREFIXOS?.[0] || ".";

        for (const p of participants || []) {
            const jid = jidDe(p);
            if (!jid) continue;

            const texto = armarTexto(cfg.mensaje, {
                user: `@${soloNum(jid.split("@")[0])}`,
                grupo: nombreGrupo,
                total,
                prefijo
            });

            const img = fuenteImagen(cfg.imagenUrl);
            const payload = img
                ? { image: img, caption: texto, mentions: [jid] }
                : { text: texto, mentions: [jid] };

            await sock.sendMessage(chatId, payload).catch((e) =>
                console.error("Error enviando bienvenida/despedida:", e?.message || e)
            );
        }
    } catch (e) {
        console.error("Error en onParticipants (welcome):", e);
    }
}

// ───────────── Comandos ─────────────
export default {
    name: "welcome",
    description: "Bienvenida y despedida personalizables por grupo (desactivadas por defecto), con imagen por adjunto o respuesta.",
    onParticipants,

    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, extra) => {
        const cmd = (comando || "").toLowerCase().trim();

        const COMANDOS = {
            welcome:       { tipo: "welcome", accion: "toggle" },
            bienvenida:    { tipo: "welcome", accion: "toggle" },
            verwelcome:    { tipo: "welcome", accion: "ver" },
            setwelcome:    { tipo: "welcome", accion: "texto" },
            setwelcomeimg: { tipo: "welcome", accion: "imagen" },
            resetwelcome:  { tipo: "welcome", accion: "reset" },
            bye:           { tipo: "bye", accion: "toggle" },
            despedida:     { tipo: "bye", accion: "toggle" },
            verbye:        { tipo: "bye", accion: "ver" },
            setbye:        { tipo: "bye", accion: "texto" },
            setbyeimg:     { tipo: "bye", accion: "imagen" },
            resetbye:      { tipo: "bye", accion: "reset" }
        };

        const def = COMANDOS[cmd];
        if (!def) return; // no es un comando de este plugin

        const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
        const guardar = () => { if (typeof guardarDB === "function") guardarDB(); };

        if (!chatId.endsWith("@g.us")) {
            return responder("⚠️ Este comando solo se puede usar dentro de los grupos.");
        }

        const g = initGrupo(db, chatId);
        const esWelcome = def.tipo === "welcome";
        const clave = esWelcome ? "welcomeConfig" : "byeConfig";
        const etiqueta = esWelcome ? "BIENVENIDA" : "DESPEDIDA";
        const nombreCmd = esWelcome ? "welcome" : "bye";
        const cfg = g[clave];

        // Permisos: dueño o admin del grupo
        const senderNum = soloNum(String(senderJid || "").split("@")[0]);
        let esAdmin = !!extra?.esDueno;

        if (!esAdmin) {
            const metadata = await sock.groupMetadata(chatId).catch(() => null);
            const yo = metadata?.participants?.find((p) =>
                p.id === senderJid ||
                p.lid === senderJid ||
                (p.phoneNumber && soloNum(p.phoneNumber.split("@")[0]) === senderNum)
            );
            esAdmin = !!yo?.admin;
        }

        const soloAdmins = () => responder("❌ Solo los administradores pueden cambiar esto.");

        // ── on / off ──
        if (def.accion === "toggle") {
            const sub = (args[0] || "").toLowerCase();
            if (!["on", "off", "activar", "desactivar"].includes(sub)) {
                return responder(
                    `⚙️ *CONFIGURACIÓN DE ${etiqueta}*\n\n` +
                    `• Estado actual: *${cfg.activo ? "🟢 Activada" : "🔴 Desactivada"}*\n\n` +
                    `• \`${prefijoUsado}${nombreCmd} on/off\`\n` +
                    `• \`${prefijoUsado}ver${nombreCmd}\`\n` +
                    `• \`${prefijoUsado}set${nombreCmd} [texto]\`\n` +
                    `• \`${prefijoUsado}set${nombreCmd}img\` (con foto o respondiendo a una)\n` +
                    `• \`${prefijoUsado}reset${nombreCmd}\` (restaura la plantilla)`
                );
            }
            if (!esAdmin) return soloAdmins();

            cfg.activo = ["on", "activar"].includes(sub);
            guardar();
            const nombre = etiqueta.charAt(0) + etiqueta.slice(1).toLowerCase();
            return responder(
                cfg.activo
                    ? `✅ ¡${nombre} activada en este grupo!`
                    : `❌ ${nombre} desactivada.`
            );
        }

        // ── ver plantilla ──
        if (def.accion === "ver") {
            const txt =
                `📜 *PLANTILLA DE ${etiqueta}*\n\n` +
                `• *Estado:* ${cfg.activo ? "🟢 ON" : "🔴 OFF"}\n` +
                `• *Imagen:* ${cfg.imagenUrl ? "personalizada" : "por defecto"}\n\n` +
                `────────────────────────\n` +
                cfg.mensaje +
                `\n────────────────────────\n` +
                `📌 *Variables:* \`{user}\`, \`{grupo}\`, \`{total}\`, \`{prefijo}\``;

            const img = fuenteImagen(cfg.imagenUrl);
            return img
                ? sock.sendMessage(chatId, { image: img, caption: txt }, { quoted: msg })
                : responder(txt);
        }

        // ── cambiar texto ──
        if (def.accion === "texto") {
            if (!esAdmin) return soloAdmins();
            const nuevo = args.join(" ").trim();
            if (!nuevo) {
                return responder(`⚠️ Escribe el texto. Ejemplo:\n\`${prefijoUsado}set${nombreCmd} Hola {user}, bienvenido a {grupo}\``);
            }
            if (nuevo.length > 1000) return responder("⚠️ El texto es demasiado largo (máx. 1000 caracteres).");

            cfg.mensaje = nuevo;
            guardar();
            return responder("✅ ¡Mensaje actualizado!");
        }

        // ── cambiar imagen ──
        if (def.accion === "imagen") {
            if (!esAdmin) return soloAdmins();

            const objetivo = obtenerImagen(msg);
            if (!objetivo) {
                return responder(`⚠️ Envía una imagen con el comando \`${prefijoUsado}set${nombreCmd}img\` o *responde a una foto* con ese comando.`);
            }

            try {
                const dir = path.resolve("database");
                fs.mkdirSync(dir, { recursive: true });

                const archivo = path.join(dir, `${nombreCmd}_${soloNum(chatId)}.jpg`);
                const stream = await downloadContentFromMessage(objetivo, "image");
                const partes = [];
                for await (const chunk of stream) partes.push(chunk);

                fs.writeFileSync(archivo, Buffer.concat(partes));
                cfg.imagenUrl = archivo;
                guardar();
                return responder("🖼️ ¡Imagen guardada y configurada con la foto seleccionada!");
            } catch (e) {
                console.error("Error al descargar la imagen:", e);
                return responder("❌ Ocurrió un error al procesar la imagen.");
            }
        }

        // ── restaurar plantilla (conserva el estado on/off) ──
        if (def.accion === "reset") {
            if (!esAdmin) return soloAdmins();
            const estado = cfg.activo;
            g[clave] = { ...clonar(PLANTILLAS[def.tipo]), activo: estado };
            guardar();
            return responder("♻️ Plantilla restaurada a la versión preestablecida.");
        }
    }
};
