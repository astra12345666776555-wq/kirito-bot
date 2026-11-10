// plugins/adv.js — Sistema de advertencias automáticas (link, spam, palabrota)
// Castigos: mute (minutos) | kick (expulsar) | ban (expulsar + lista negra).
// El bot necesita ser ADMIN del grupo para borrar mensajes y expulsar.

const FILTROS = ["link", "spam", "palabrota"];
const ACCIONES = ["mute", "kick", "ban"];

// ------------------------------------------------------------------ configuración
const cfgPorDefecto = () => ({
    adminsLibres: true, // true = los admins NO reciben castigos
    filtros: {
        link: { activo: false, accion: "mute", max: 3, tiempo: 10, modo: "todos" }, // modo: "todos" | "wa"
        spam: { activo: false, accion: "mute", max: 3, tiempo: 5, msgs: 5, segundos: 6 },
        palabrota: { activo: false, accion: "mute", max: 3, tiempo: 5 }
    },
    palabras: []
});

function obtenerGrupo(db, chatId) {
    db.grupos ||= {};
    const g = (db.grupos[chatId] ||= {});
    const base = cfgPorDefecto();
    const c = (g.advConfig ||= base);
    if (typeof c.adminsLibres !== "boolean") c.adminsLibres = base.adminsLibres;
    c.filtros ||= {};
    for (const f of FILTROS) c.filtros[f] = { ...base.filtros[f], ...(c.filtros[f] || {}) };
    c.palabras ||= [];
    g.advWarns ||= {};
    g.advJids ||= {};
    g.advMutes ||= {};
    g.baneados ||= {};
    return g;
}

// ------------------------------------------------------------------ utilidades
const digitos = (s) => String(s || "").replace(/[^0-9]/g, "");
const parteJid = (j) => String(j || "").split("@")[0].split(":")[0];
const tag = (jid) => "@" + parteJid(jid);
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const cuando = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? " " + (min % 60) + " min" : ""}` : `${min} min`);

async function numeroDe(sock, jid, alt) {
    if (alt && String(alt).endsWith("@s.whatsapp.net")) return digitos(parteJid(alt));
    if (String(jid).endsWith("@s.whatsapp.net")) return digitos(parteJid(jid));
    if (String(jid).endsWith("@lid")) {
        try {
            const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid);
            if (pn) return digitos(parteJid(pn));
        } catch { /* sin mapeo conocido */ }
    }
    return digitos(parteJid(jid));
}

const metaCache = new Map();
async function metadata(sock, chatId, forzar = false) {
    const c = metaCache.get(chatId);
    if (!forzar && c && Date.now() - c.t < 30_000) return c.meta;
    const meta = await sock.groupMetadata(chatId).catch(() => null);
    if (meta) metaCache.set(chatId, { t: Date.now(), meta });
    return meta;
}

function coincide(p, candidatos) {
    const ids = [p.id, p.lid, p.phoneNumber].filter(Boolean).map(parteJid);
    return candidatos.filter(Boolean).map(parteJid).some((c) => ids.includes(c));
}
async function esAdminGrupo(sock, chatId, jids) {
    const meta = await metadata(sock, chatId);
    return !!meta?.participants?.some((p) => p.admin && coincide(p, jids));
}
async function botEsAdmin(sock, chatId) {
    const meta = await metadata(sock, chatId);
    const yo = [sock.user?.id, sock.user?.lid];
    return !!meta?.participants?.some((p) => p.admin && coincide(p, yo));
}

// ------------------------------------------------------------------ detectores
const RE_WA = /(chat\.whatsapp\.com\/[A-Za-z0-9]+|whatsapp\.com\/(channel|invite)\/|wa\.me\/|api\.whatsapp\.com\/)/i;
const RE_LINK = /(https?:\/\/|www\.|\b(chat\.whatsapp\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|discord\.gg|discord\.com\/invite|bit\.ly|tinyurl\.com|youtu\.be|youtube\.com|tiktok\.com|instagram\.com|facebook\.com|fb\.me|linktr\.ee)\b)/i;

function hayLink(texto, contenido, modo) {
    const t = [texto, contenido?.extendedTextMessage?.matchedText, contenido?.extendedTextMessage?.canonicalUrl].filter(Boolean).join(" ");
    return (modo === "wa" ? RE_WA : RE_LINK).test(t);
}

const PALABROTAS = [
    "puta", "puto", "putita", "hdp", "hijo de puta", "hijueputa", "hijoeputa", "mierda", "carajo", "pendejo", "pendeja", "cabron", "cabrona",
    "gilipollas", "imbecil", "idiota", "estupido", "estupida", "maricon", "malparido", "culiao", "culiado", "conchatumadre", "conchetumare",
    "concha de tu madre", "ctm", "ctmr", "verga", "pinche", "zorra", "perra", "basura", "mamahuevo", "webon", "huevon"
];
const limpiarTexto = (s) =>
    norm(s).replace(/[0]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/7/g, "t")
        // "p.u.t.a" / "pu-t-a": une letras separadas por símbolos
        .replace(/[a-z]+(?:[.\-_*][a-z]+){2,}/g, (m) => (m.length <= 14 ? m.replace(/[.\-_*]/g, "") : m))
        .replace(/[^a-z\s]/g, " ").replace(/(.)\1{2,}/g, "$1").replace(/\s+/g, " ");
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function hayPalabrota(texto, extras = []) {
    const t = " " + limpiarTexto(texto) + " ";
    for (const w of [...PALABROTAS, ...extras]) {
        const p = limpiarTexto(w).trim();
        if (p && new RegExp(`(?<![a-z])${escapar(p)}(?:s|es)?(?![a-z])`).test(t)) return p;
    }
    return null;
}

const historial = new Map(); // "chat|numero" -> [{ t, key, txt }]
function detectarSpam(chatId, num, msg, texto, f) {
    const k = chatId + "|" + num, ahora = Date.now();
    const h = (historial.get(k) || []).filter((x) => ahora - x.t < 30_000);
    h.push({ t: ahora, key: msg.key, txt: norm(texto).trim() });
    historial.set(k, h);
    const ventana = h.filter((x) => ahora - x.t < f.segundos * 1000);
    const iguales = h.filter((x) => x.txt && x.txt === h[h.length - 1].txt);
    if (ventana.length >= f.msgs) return { claves: ventana.map((x) => x.key), motivo: `${ventana.length} mensajes en ${f.segundos}s` };
    if (iguales.length >= 4) return { claves: iguales.map((x) => x.key), motivo: "mensajes repetidos" };
    return null;
}

// ------------------------------------------------------------------ sanciones
const avisoSinAdmin = new Map();
const MOTIVOS = { link: "enviar enlaces", spam: "hacer spam", palabrota: "usar lenguaje ofensivo" };
const ACCION_TXT = (f) => (f.accion === "mute" ? `silenciado ${cuando(f.tiempo)}` : f.accion === "kick" ? "expulsado" : "baneado");

async function restaurarMutes(db) {
    if (global.__advRestaurado) return;
    global.__advRestaurado = true;
    global.mutados ||= {};
    for (const [chatId, g] of Object.entries(db.grupos || {})) {
        for (const [jid, exp] of Object.entries(g.advMutes || {})) {
            if (exp > Date.now()) (global.mutados[chatId] ||= {})[jid] = exp; else delete g.advMutes[jid];
        }
    }
}

async function sancionar({ sock, msg, chatId, senderJid, db, guardarDB, tipo, detalle, claves }) {
    const g = obtenerGrupo(db, chatId), f = g.advConfig.filtros[tipo];
    const participante = msg.key.participant || senderJid;
    const num = await numeroDe(sock, participante, msg.key.participantAlt);
    const soyAdmin = await botEsAdmin(sock, chatId);

    if (soyAdmin) for (const k of claves || [msg.key]) await sock.sendMessage(chatId, { delete: k }).catch(() => {});

    const w = (g.advWarns[num] ||= { link: 0, spam: 0, palabrota: 0 });
    w[tipo] = (w[tipo] || 0) + 1;
    g.advJids[num] = participante;
    const motivo = MOTIVOS[tipo] + (detalle ? ` (${detalle})` : "");

    if (w[tipo] < f.max) {
        guardarDB?.();
        let txt = `⚠️ *ADVERTENCIA ${w[tipo]}/${f.max}* ${tag(participante)}\n• Motivo: ${motivo}\n• Al llegar a ${f.max} serás *${ACCION_TXT(f)}*.`;
        if (!soyAdmin && Date.now() - (avisoSinAdmin.get(chatId) || 0) > 300_000) {
            avisoSinAdmin.set(chatId, Date.now());
            txt += `\n\n_Nota: no soy administrador, por eso no puedo borrar mensajes ni expulsar._`;
        }
        return sock.sendMessage(chatId, { text: txt, mentions: [participante] }, { quoted: msg });
    }

    w[tipo] = 0;
    const cab = `🚨 *LÍMITE ALCANZADO (${f.max}/${f.max})* ${tag(participante)}\n• Motivo: ${motivo}\n`;
    if (f.accion === "mute") {
        const exp = Date.now() + f.tiempo * 60_000;
        (global.mutados[chatId] ||= {})[senderJid] = exp;
        if (senderJid !== participante) global.mutados[chatId][participante] = exp;
        g.advMutes[senderJid] = exp; if (senderJid !== participante) g.advMutes[participante] = exp;
        guardarDB?.();
        return sock.sendMessage(chatId, {
            text: cab + `• Castigo: 🔇 *silenciado ${cuando(f.tiempo)}* (sus mensajes se borrarán)` + (soyAdmin ? "" : "\n\n_Necesito ser administrador para borrar sus mensajes._"),
            mentions: [participante]
        }, { quoted: msg });
    }
    if (!soyAdmin) {
        guardarDB?.();
        return sock.sendMessage(chatId, { text: cab + `• Castigo: *${f.accion.toUpperCase()}*\n\n❌ No pude aplicarlo: necesito ser *administrador* del grupo.`, mentions: [participante] }, { quoted: msg });
    }
    if (f.accion === "ban") g.baneados[num] = { fecha: Date.now(), motivo: MOTIVOS[tipo] };
    guardarDB?.();
    await sock.sendMessage(chatId, { text: cab + `• Castigo: ${f.accion === "ban" ? "⛔ *BAN*" : "👢 *expulsado*"}`, mentions: [participante] });
    await sock.groupParticipantsUpdate(chatId, [participante], "remove").catch(async (e) => {
        await sock.sendMessage(chatId, { text: `❌ No pude expulsar a ${tag(participante)} (${e?.message || "error"}). ¿Es admin o creador del grupo?`, mentions: [participante] });
    });
}

// ------------------------------------------------------------------ HOOKS (los llama index.js)
async function onMessage({ sock, msg, chatId, senderJid, texto, contenido, esDueno, db, guardarDB }) {
    await restaurarMutes(db);
    const g = db.grupos?.[chatId]?.advConfig ? obtenerGrupo(db, chatId) : null;
    if (!g) return false;
    const F = g.advConfig.filtros;
    if (!FILTROS.some((x) => F[x].activo)) return false;
    if (esDueno || msg.key.fromMe) return false;

    const participante = msg.key.participant || senderJid;
    const num = await numeroDe(sock, participante, msg.key.participantAlt);

    let infraccion = null;
    if (F.link.activo && hayLink(texto, contenido, F.link.modo)) infraccion = { tipo: "link" };
    else if (F.palabrota.activo && texto) {
        const p = hayPalabrota(texto, g.advConfig.palabras);
        if (p) infraccion = { tipo: "palabrota" };
    }
    if (!infraccion && F.spam.activo) {
        const s = detectarSpam(chatId, num, msg, texto, F.spam);
        if (s) { infraccion = { tipo: "spam", detalle: s.motivo, claves: s.claves }; historial.delete(chatId + "|" + num); }
    }
    if (!infraccion) return false;

    if (g.advConfig.adminsLibres && (await esAdminGrupo(sock, chatId, [participante, msg.key.participantAlt, senderJid]))) return false;

    await sancionar({ sock, msg, chatId, senderJid, db, guardarDB, ...infraccion });
    return true;
}

async function onParticipants({ sock, ev, db }) {
    if (ev.action !== "add") return;
    const g = db.grupos?.[ev.id]?.baneados ? db.grupos[ev.id] : null;
    if (!g || !Object.keys(g.baneados).length) return;
    for (const p of ev.participants || []) {
        const jid = typeof p === "string" ? p : p.id;
        const alt = typeof p === "string" ? null : p.phoneNumber;
        const num = await numeroDe(sock, jid, alt);
        if (!g.baneados[num]) continue;
        if (!(await botEsAdmin(sock, ev.id))) continue;
        await sock.sendMessage(ev.id, { text: `⛔ ${tag(jid)} está *baneado* de este grupo. Fue expulsado de nuevo.`, mentions: [jid] }).catch(() => {});
        await sock.groupParticipantsUpdate(ev.id, [jid], "remove").catch(() => {});
    }
}

// ------------------------------------------------------------------ COMANDO .adv
const estado = (f) => (f.activo ? `🟢 ${f.accion}, máx ${f.max}${f.accion === "mute" ? `, ${f.tiempo} min` : ""}` : "🔴 OFF");

function panel(g, p) {
    const F = g.advConfig.filtros;
    return `🛡️ *SISTEMA DE ADVERTENCIAS (ADV)*\n\n` +
        `• *link:* ${estado(F.link)} _(modo: ${F.link.modo === "wa" ? "solo enlaces de WhatsApp" : "todos los enlaces"})_\n` +
        `• *spam:* ${estado(F.spam)} _(${F.spam.msgs} msgs en ${F.spam.segundos}s)_\n` +
        `• *palabrota:* ${estado(F.palabrota)} _(+${g.advConfig.palabras.length} palabras propias)_\n` +
        `• *admins libres:* ${g.advConfig.adminsLibres ? "Sí" : "No"}\n\n` +
        `📌 *Configurar*\n` +
        `\`${p}adv link ban 1 on\` → ban al 1er link\n` +
        `\`${p}adv link mute 3 on 10\` → mute 10 min al 3er aviso\n` +
        `\`${p}adv spam kick 3 on\` · \`${p}adv palabrota mute 3 on 5\`\n` +
        `\`${p}adv link off\` → desactivar\n` +
        `\`${p}adv link modo wa|todos\` → qué enlaces cuentan\n` +
        `\`${p}adv spam limite 5 6\` → 5 mensajes en 6 s\n` +
        `\`${p}adv admin on|off\` → ¿los admins también reciben castigos?\n\n` +
        `🧰 *Gestión*\n` +
        `\`${p}adv warns [@user]\` · \`${p}adv quitar @user\` · \`${p}adv reset @user|todos\`\n` +
        `\`${p}adv palabra add|del|lista <palabra>\`\n` +
        `\`${p}adv bans\` · \`${p}adv unban @user|número\`\n\n` +
        `_El bot debe ser administrador del grupo._`;
}

async function objetivo(sock, msg, args) {
    const ci = Object.values(msg.message || {}).find((v) => v && typeof v === "object" && v.contextInfo)?.contextInfo;
    const jid = ci?.mentionedJid?.[0] || ci?.participant;
    if (jid) return { jid, num: await numeroDe(sock, jid) };
    const d = args.map(digitos).find((x) => x.length >= 8);
    return d ? { jid: d + "@s.whatsapp.net", num: d } : null;
}

async function run(comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, extra) {
    if ((comando || "").toLowerCase().trim() !== "adv") return;
    const responder = (text, mentions = []) => sock.sendMessage(chatId, { text, mentions }, { quoted: msg });
    const p = prefijoUsado || ".";

    if (!chatId.endsWith("@g.us")) return responder("⚠️ Este comando de moderación solo se usa en grupos.");

    const participante = msg.key.participant || (typeof senderJid === "string" ? senderJid : "");
    const esDueno = !!extra?.esDueno || digitos(parteJid(senderJid)) === digitos(CONFIG?.OWNER_NUMBER || "51947497514");
    if (!esDueno && !(await esAdminGrupo(sock, chatId, [participante, msg.key.participantAlt, senderJid]))) {
        return responder("❌ Solo los administradores o el dueño pueden configurar el sistema de advertencias.");
    }

    const g = obtenerGrupo(db, chatId), C = g.advConfig;
    const sub = (args[0] || "").toLowerCase();
    const guardar = () => guardarDB?.();

    if (!sub || sub === "help" || sub === "ayuda" || sub === "estado") return responder(panel(g, p));

    if (sub === "admin" || sub === "admins") {
        const v = (args[1] || "").toLowerCase();
        if (!["on", "off"].includes(v)) return responder(`⚙️ Admins libres: *${C.adminsLibres ? "Sí (off)" : "No (on)"}*\n\n\`${p}adv admin on\` → los admins también reciben advertencias\n\`${p}adv admin off\` → admins libres de castigos`);
        C.adminsLibres = v === "off"; guardar();
        return responder(`✅ Admins libres: *${C.adminsLibres ? "SÍ" : "NO"}*`);
    }

    if (sub === "warns" || sub === "avisos") {
        const t = await objetivo(sock, msg, args.slice(1));
        const filas = Object.entries(g.advWarns).filter(([n, w]) => (!t || n === t.num) && FILTROS.some((x) => w[x] > 0));
        if (!filas.length) return responder("✅ No hay advertencias activas" + (t ? " para ese usuario." : "."));
        const mentions = filas.map(([n]) => g.advJids[n]).filter(Boolean);
        return responder("📋 *Advertencias activas*\n\n" + filas.map(([n, w]) => `• ${g.advJids[n] ? tag(g.advJids[n]) : "+" + n} — ` + FILTROS.filter((x) => w[x] > 0).map((x) => `${x}: ${w[x]}/${C.filtros[x].max}`).join(", ")).join("\n"), mentions);
    }
    if (sub === "quitar") {
        const t = await objetivo(sock, msg, args.slice(1));
        if (!t) return responder(`❌ Menciona o responde al usuario: \`${p}adv quitar @user\``);
        const w = g.advWarns[t.num], tipo = FILTROS.find((x) => w?.[x] > 0);
        if (!tipo) return responder("✅ Ese usuario no tiene advertencias.");
        w[tipo]--; guardar();
        return responder(`✅ Se quitó 1 advertencia de *${tipo}*.`);
    }
    if (sub === "reset") {
        if ((args[1] || "").toLowerCase() === "todos") { g.advWarns = {}; guardar(); return responder("✅ Todas las advertencias del grupo fueron borradas."); }
        const t = await objetivo(sock, msg, args.slice(1));
        if (!t) return responder(`❌ Uso: \`${p}adv reset @user\` o \`${p}adv reset todos\``);
        delete g.advWarns[t.num]; guardar();
        return responder("✅ Advertencias del usuario borradas.");
    }

    if (sub === "bans" || sub === "baneados") {
        const l = Object.entries(g.baneados);
        return responder(l.length ? "⛔ *Baneados del grupo*\n\n" + l.map(([n, b]) => `• +${n} — ${b.motivo} (${new Date(b.fecha).toLocaleDateString("es-PE")})`).join("\n") + `\n\n\`${p}adv unban número\`` : "✅ No hay usuarios baneados.");
    }
    if (sub === "unban") {
        const t = await objetivo(sock, msg, args.slice(1));
        if (!t || !g.baneados[t.num]) return responder(`❌ No encontré ese usuario en la lista de baneados (usa \`${p}adv bans\`).`);
        delete g.baneados[t.num]; guardar();
        return responder(`✅ +${t.num} ya no está baneado. Podrá volver a entrar.`);
    }

    if (sub === "palabra" || sub === "palabras") {
        const a = (args[1] || "").toLowerCase(), w = norm(args.slice(2).join(" ")).trim();
        if (a === "lista" || !a) return responder(`📝 *Palabras propias (${C.palabras.length})*\n${C.palabras.join(", ") || "_ninguna_"}\n\n\`${p}adv palabra add <palabra>\` · \`${p}adv palabra del <palabra>\`\n_Además de la lista básica del bot._`);
        if (!w) return responder("❌ Escribe la palabra.");
        if (a === "add") { if (!C.palabras.includes(w)) C.palabras.push(w); guardar(); return responder(`✅ Añadida: *${w}*`); }
        if (a === "del") { C.palabras = C.palabras.filter((x) => x !== w); guardar(); return responder(`✅ Eliminada: *${w}*`); }
        return responder("❌ Usa add, del o lista.");
    }

    if (!FILTROS.includes(sub)) return responder(`⚠️ Filtro desconocido. Usa: ${FILTROS.join(", ")}\n\n\`${p}adv\` para ver la ayuda.`);
    const f = C.filtros[sub], t = args.slice(1).map((x) => x.toLowerCase());

    if (t[0] === "modo" && sub === "link") {
        if (!["wa", "todos"].includes(t[1])) return responder(`❌ Uso: \`${p}adv link modo wa\` (solo enlaces de WhatsApp) o \`${p}adv link modo todos\``);
        f.modo = t[1]; guardar();
        return responder(`✅ Filtro link: *${t[1] === "wa" ? "solo enlaces de WhatsApp" : "todos los enlaces"}*`);
    }
    if (t[0] === "limite" && sub === "spam") {
        const m = parseInt(t[1]), s = parseInt(t[2]);
        if (!(m >= 2 && m <= 30) || !(s >= 2 && s <= 60)) return responder(`❌ Uso: \`${p}adv spam limite 5 6\` (mensajes 2-30, segundos 2-60)`);
        f.msgs = m; f.segundos = s; guardar();
        return responder(`✅ Spam: *${m} mensajes en ${s} segundos*.`);
    }
    if (t.includes("off")) { f.activo = false; guardar(); return responder(`❌ Filtro de *${sub}* desactivado.`); }

    const accion = t.find((x) => ACCIONES.includes(x));
    const nums = t.map((x) => parseInt(x)).filter((n) => Number.isInteger(n) && n > 0);
    if (!accion && !t.includes("on") && !nums.length) return responder(`⚠️ Formato incorrecto.\nEjemplos:\n\`${p}adv ${sub} mute 3 on 10\`\n\`${p}adv ${sub} ban 1 on\`\n\`${p}adv ${sub} off\``);

    if (accion) f.accion = accion;
    if (nums[0]) f.max = Math.min(nums[0], 20);
    if (nums[1]) f.tiempo = Math.min(nums[1], 10080);
    f.activo = true; guardar();

    const soyAdmin = await botEsAdmin(sock, chatId);
    return responder(
        `🛡️ ¡Filtro *${sub}* configurado y activado!\n\n• Acción: *${f.accion.toUpperCase()}*\n• Límite: *${f.max} advertencia${f.max > 1 ? "s" : ""}*\n` +
        (f.accion === "mute" ? `• Duración: *${cuando(f.tiempo)}*\n` : "") +
        `• Admins libres: *${C.adminsLibres ? "Sí" : "No"}*` +
        (soyAdmin ? "" : `\n\n⚠️ *Ojo:* el bot no es administrador del grupo; sin eso no puede borrar mensajes ni expulsar. Hazlo admin.`)
    );
}

export default { name: "adv", description: "Advertencias automáticas (link, spam, palabrota) con castigos mute/kick/ban.", run, onMessage, onParticipants };
