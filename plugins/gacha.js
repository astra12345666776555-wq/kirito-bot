import fs from "fs";
import path from "path";

/* ════════════════════════════════════════════════════════════════
   GACHA · Kirito Bot
   Personajes en  ./characters.json
   Imágenes en    ./media/   (ver orden de prioridad en candidatosImagen)
   Datos por grupo en db.grupos[chatId].gacha  (no toca la economía de otros plugins)
   ════════════════════════════════════════════════════════════════ */

// ── Ajustes ────────────────────────────────────────────────────
// Tiempos por defecto. Se pueden cambiar con el comando .setcd (el dueño), sin tocar el código.
const MIN = 60 * 1000, HORA = 60 * MIN, DIA = 24 * HORA;
const CD_DEFECTO = { roll: 5 * MIN, claim: 60 * 1000, voto: 24 * HORA };   // tirada, ventana para reclamar, voto
const CD_LIMITES = { roll: [0, DIA], claim: [5 * 1000, 10 * MIN], voto: [0, 7 * DIA] };
const CD_NOMBRES = { roll: "Tirada (.rw)", claim: "Ventana para reclamar (.claim)", voto: "Voto (.vote)" };
const CD_ALIAS = { roll: "roll", tirada: "roll", rw: "roll", tirar: "roll", claim: "claim", reclamo: "claim", reclamar: "claim", ventana: "claim", voto: "voto", vote: "voto", votar: "voto" };
const BONO_POR_VOTO = 10;                      // cada voto sube el valor del personaje
const PRECIO_MAX = 100_000_000;
const POR_PAGINA = 10;
const PESOS_RAREZA = [60, 25, 12, 3];          // Común, Raro, Épico, Legendario

// ── Rutas ──────────────────────────────────────────────────────
const RAIZ = path.resolve(".");
const ARCHIVO_PERSONAJES = path.join(RAIZ, "characters.json");
const DIR_MEDIA = path.join(RAIZ, "media");
const DIR_CARDS = path.join(DIR_MEDIA, "cards");
const DIR_PERSONAJES = path.join(DIR_MEDIA, "personajes");
const IMG_DEFECTO = path.join(DIR_MEDIA, "default_personaje.jpg");
const IMG_GACHA = path.join(DIR_MEDIA, "gacha.jpg");

// ── Comandos y alias ───────────────────────────────────────────
const ALIAS = {
    roll: ["rollwaifu", "rw", "roll"],
    claim: ["claim", "c", "reclamar"],
    harem: ["harem", "waifus", "claims", "coleccion"],
    charinfo: ["charinfo", "winfo", "waifuinfo"],
    charimage: ["charimage", "waifuimage", "cimage", "wimage"],
    sell: ["sell", "vender"],
    haremshop: ["haremshop", "tiendawaifus", "wshop"],
    buychar: ["buycharacter", "buychar", "buyc"],
    removesale: ["removesale", "removerventa"],
    givechar: ["givechar", "givewaifu", "regalar"],
    giveall: ["giveallharem"],
    delchar: ["deletewaifu", "delwaifu", "delchar"],
    setfav: ["setfavourite", "setfav"],
    delfav: ["delfavourite", "delfav"],
    favtop: ["favoritetop", "favtop"],
    top: ["waifusboard", "waifustop", "topwaifus", "wtop"],
    info: ["gachainfo", "ginfo", "infogacha"],
    vote: ["vote", "votar"],
    serielist: ["serielist", "slist", "animelist"],
    serieinfo: ["serieinfo", "ainfo", "animeinfo"],
    cooldowns: ["cooldowns", "cooldown", "cd", "tiempos"],
    setcd: ["setcd", "setcooldown"],
    cdreset: ["cdreset", "resetcd"],
    setclaimmsg: ["setclaimmsg", "setclaim"],
    delclaimmsg: ["delclaimmsg"],
    addchar: ["addchar"],
    setcharimg: ["setcharimg"]
};
const MAPA = {};
for (const [accion, lista] of Object.entries(ALIAS)) for (const a of lista) MAPA[a] = accion;

// ── Utilidades ─────────────────────────────────────────────────
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "personaje";

function rareza(valor) {
    if (valor >= 1000) return { t: 3, nombre: "Legendario", icono: "🟡" };
    if (valor >= 600) return { t: 2, nombre: "Épico", icono: "🟣" };
    if (valor >= 300) return { t: 1, nombre: "Raro", icono: "🔵" };
    return { t: 0, nombre: "Común", icono: "⚪" };
}

// 7d · 2d 3h · 24h · 1h 05m · 4m 30s · 5m · 45s
function fmt(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    if (t < 60) return `${t}s`;
    const d = Math.floor(t / 86400), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), seg = t % 60;
    if (d >= 2) { const hh = Math.floor((t % 86400) / 3600); return `${d}d${hh ? ` ${hh}h` : ""}`; }
    if (h >= 1) return `${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}`;
    return `${Math.floor(t / 60)}m${seg ? ` ${String(seg).padStart(2, "0")}s` : ""}`;
}

// "30s", "5m", "2h", "1d", "1h30m"  →  milisegundos (null si no se entiende)
function parseTiempo(texto) {
    const t = norm(texto).replace(/\s+/g, "");
    if (!/^(?:\d+(?:d|h|min|m|seg|s))+$/.test(t)) return null;
    const U = { d: DIA, h: HORA, min: MIN, m: MIN, seg: 1000, s: 1000 };
    let total = 0;
    for (const m of t.matchAll(/(\d+)(d|h|min|m|seg|s)/g)) total += parseInt(m[1], 10) * U[m[2]];
    return total;
}

// Tiempos en uso: los de la base de datos (si el dueño los cambió) o los de por defecto
function tiemposGacha(db) {
    const guardados = db?.global?.gachaCooldowns || {};
    const r = {};
    for (const k of Object.keys(CD_DEFECTO)) r[k] = Number.isFinite(guardados[k]) ? guardados[k] : CD_DEFECTO[k];
    return r;
}

function paginar(arr, pagina) {
    const total = Math.max(1, Math.ceil(arr.length / POR_PAGINA));
    const p = Math.min(Math.max(1, pagina || 1), total);
    return { items: arr.slice((p - 1) * POR_PAGINA, p * POR_PAGINA), pagina: p, total };
}

// Caché de characters.json (se recarga solo si el archivo cambia)
let cachePersonajes = { mtime: 0, lista: [] };
function cargarPersonajes() {
    try {
        const st = fs.statSync(ARCHIVO_PERSONAJES);
        if (st.mtimeMs !== cachePersonajes.mtime) {
            const data = JSON.parse(fs.readFileSync(ARCHIVO_PERSONAJES, "utf8"));
            const lista = (Array.isArray(data) ? data : [])
                .filter(p => p && p.id && p.nombre)
                .map(p => ({
                    id: String(p.id),
                    nombre: String(p.nombre),
                    serie: String(p.serie || "Sin serie"),
                    genero: String(p.genero || "otro"),
                    valor: Math.max(1, parseInt(p.valor) || 100),
                    img: Array.isArray(p.img) ? p.img : []
                }));
            cachePersonajes = { mtime: st.mtimeMs, lista };
        }
    } catch (e) {
        console.error("[GACHA] No se pudo leer characters.json:", e.message);
    }
    return cachePersonajes.lista;
}

function guardarPersonajes(lista) {
    const tmp = ARCHIVO_PERSONAJES + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(lista, null, 2), "utf8");
    fs.renameSync(tmp, ARCHIVO_PERSONAJES);
    cachePersonajes.mtime = 0;
}

function buscarPersonaje(lista, texto) {
    const q = norm(texto);
    if (!q) return null;
    return lista.find(p => p.id === q)
        || lista.find(p => norm(p.nombre) === q)
        || lista.find(p => norm(p.nombre).startsWith(q))
        || lista.find(p => norm(p.nombre).includes(q))
        || null;
}

const generoTexto = (g) => { const x = norm(g); return x === "mujer" ? "Mujer" : x === "hombre" ? "Hombre" : "Otro"; };

// Ficha simple (la misma que usan tirada e info)
function ficha(p, valor, estado, extra = "") {
    return `❀ Nombre » *${p.nombre}*\n⚥ Género » *${generoTexto(p.genero)}*\n✰ Valor » *${valor}*\n♡ Estado » *${estado}*\n❖ Fuente » *${p.serie}*${extra}`;
}

// Descarga una imagen desde un enlace directo (.jpg, .png, .webp)
const MAX_IMAGEN_BYTES = 3 * 1024 * 1024;
async function descargarImagen(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`el enlace respondió con error ${res.status}`);
    const tipo = String(res.headers.get("content-type") || "").toLowerCase();
    if (!tipo.startsWith("image/")) throw new Error("el enlace no es una imagen directa (debe abrir solo la foto, no una página)");
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGEN_BYTES) throw new Error(`la imagen pesa ${(buffer.length / 1048576).toFixed(1)} MB y el máximo es 3 MB`);
    const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
    return { buffer, ext };
}

// ── Estado en la base de datos ─────────────────────────────────
function estadoGrupo(db, chatId) {
    if (!db.grupos) db.grupos = {};
    if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
    const g = db.grupos[chatId];
    if (!g.usuarios) g.usuarios = {};
    if (!g.gacha) g.gacha = {};
    const x = g.gacha;
    if (!x.reclamados) x.reclamados = {};   // idPersonaje -> { dueno, fecha }
    if (!x.ventas) x.ventas = {};           // idPersonaje -> { precio, vendedor }
    if (!x.votos) x.votos = {};             // idPersonaje -> cantidad
    if (!x.rollsPorMensaje) x.rollsPorMensaje = {};
    if (x.ultimoRoll === undefined) x.ultimoRoll = null;
    return g;
}

function usuarioGrupo(g, jid) {
    if (!g.usuarios[jid]) g.usuarios[jid] = { cartera: 0, banco: 0 };
    const u = g.usuarios[jid];
    if (!u.gacha) u.gacha = { ultimoRoll: 0, favorito: null, ultimoVoto: 0, mensajeClaim: null };
    return u;
}

const valorActual = (g, p) => p.valor + (g.gacha.votos[p.id] || 0) * BONO_POR_VOTO;
const duenoDe = (g, id) => g.gacha.reclamados[id]?.dueno || null;
const misIds = (g, jid) => Object.entries(g.gacha.reclamados).filter(([, v]) => v.dueno === jid).map(([id]) => id);

// ── Imágenes (siempre hay una por defecto) ─────────────────────
// Prioridad: 1) archivo propio media/personajes/<id>.(jpg|png|webp)
//            2) URL(s) del campo "img" de characters.json
//            3) tarjeta generada media/cards/<id>.jpg
//            4) media/default_personaje.jpg
function leerSiExiste(ruta) {
    try { return fs.existsSync(ruta) ? fs.readFileSync(ruta) : null; } catch { return null; }
}

function candidatosImagen(p) {
    const res = [];
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
        const b = leerSiExiste(path.join(DIR_PERSONAJES, `${p.id}.${ext}`));
        if (b) { res.push(b); break; }
    }
    const urls = (p.img || []).filter(u => typeof u === "string" && /^https?:\/\//i.test(u));
    if (urls.length) res.push({ url: urls[Math.floor(Math.random() * urls.length)] });
    const card = leerSiExiste(path.join(DIR_CARDS, `${p.id}.jpg`));
    if (card) res.push(card);
    const def = leerSiExiste(IMG_DEFECTO);
    if (def) res.push(def);
    return res;
}

async function enviarConImagen(sock, chatId, imagenes, caption, mentions, msg) {
    for (const image of imagenes) {
        try {
            return await sock.sendMessage(chatId, { image, caption, mentions }, { quoted: msg });
        } catch (e) {
            console.error("[GACHA] Falló una imagen, pruebo la siguiente:", e.message);
        }
    }
    return await sock.sendMessage(chatId, { text: caption, mentions }, { quoted: msg });
}

const imagenGacha = () => { const b = leerSiExiste(IMG_GACHA) || leerSiExiste(IMG_DEFECTO); return b ? [b] : []; };

// ── Sorteo con rareza ──────────────────────────────────────────
function elegirPersonaje(lista, g) {
    const libres = lista.filter(p => !g.gacha.reclamados[p.id]);
    const base = (libres.length && Math.random() < 0.85) ? libres : lista;
    const porTier = [0, 1, 2, 3].map(t => base.filter(p => rareza(p.valor).t === t));
    const pesos = porTier.map((arr, t) => (arr.length ? PESOS_RAREZA[t] : 0));
    const suma = pesos.reduce((a, b) => a + b, 0);
    if (suma === 0) return base[Math.floor(Math.random() * base.length)];
    let r = Math.random() * suma, t = 0;
    for (; t < 4; t++) { if (r < pesos[t]) break; r -= pesos[t]; }
    const arr = porTier[Math.min(t, 3)];
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Plugin ─────────────────────────────────────────────────────
export default {
    name: "gacha",
    description: "Sistema gacha: tirar, reclamar, colección, tienda y comercio de personajes con imágenes por defecto",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        const cmd = norm(comando);
        const accion = MAPA[cmd];
        if (!accion) return;

        const P = prefijoUsado || ".";
        const responder = (text, mentions = []) => sock.sendMessage(chatId, { text, mentions }, { quoted: msg });
        const tag = (jid) => (typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(jid) : "@" + String(jid).split("@")[0]);
        const dinero = (n) => (typeof formatoMoneda === "function" ? formatoMoneda(n) : Number(n).toLocaleString("es-PE"));
        const guardar = () => { if (typeof guardarDB === "function") guardarDB(); };

        const enGrupo = chatId.endsWith("@g.us");
        if (!enGrupo && accion !== "addchar" && accion !== "setcharimg") {
            return responder("⚠️ El gacha solo se puede jugar dentro de los grupos.");
        }

        try {
            const lista = cargarPersonajes();
            if (lista.length === 0) {
                return responder("⚠️ No hay personajes cargados. Falta el archivo *characters.json* en la carpeta del bot.");
            }

            const g = enGrupo ? estadoGrupo(db, chatId) : null;
            const yo = g ? usuarioGrupo(g, senderJid) : null;
            const ahora = Date.now();
            const CD = tiemposGacha(db);
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const objetivoJid = ctx?.mentionedJid?.[0] || ctx?.participant || null;
            const ownerJid = String(CONFIG?.OWNER_NUMBER || "") + "@s.whatsapp.net";
            const esDueno = senderJid === ownerJid;
            const textoSinMenciones = args.filter(a => !a.startsWith("@")).join(" ").trim();
            const ultimoNumero = parseInt(args[args.length - 1]);

            // ═════════ TIRAR ═════════
            if (accion === "roll") {
                const falta = yo.gacha.ultimoRoll + CD.roll - ahora;
                if (falta > 0) {
                    return responder(`⏳ Ya tiraste hace poco. Podrás volver a tirar en *${fmt(falta)}*.`);
                }
                const p = elegirPersonaje(lista, g);
                yo.gacha.ultimoRoll = ahora;

                const dueno = duenoDe(g, p.id);
                const txt = ficha(p, valorActual(g, p), dueno ? `Reclamado por ${tag(dueno)}` : "Libre");

                const menciones = dueno ? [dueno] : [];
                const enviado = await enviarConImagen(sock, chatId, candidatosImagen(p), txt, menciones, msg);

                const idMsg = enviado?.key?.id;
                const registro = { id: p.id, ts: ahora, roller: senderJid };
                g.gacha.ultimoRoll = registro;
                if (idMsg) {
                    g.gacha.rollsPorMensaje[idMsg] = registro;
                    for (const [k, v] of Object.entries(g.gacha.rollsPorMensaje)) {
                        if (ahora - v.ts > 10 * 60 * 1000) delete g.gacha.rollsPorMensaje[k];
                    }
                }
                guardar();
                return;
            }

            // ═════════ RECLAMAR ═════════
            if (accion === "claim") {
                const idCitado = ctx?.stanzaId;
                const roll = (idCitado && g.gacha.rollsPorMensaje[idCitado]) || g.gacha.ultimoRoll;
                if (!roll) return responder(`⚠️ No hay ningún personaje para reclamar. Usa \`${P}rw\` para tirar.`);
                if (ahora - roll.ts > CD.claim) {
                    return responder("⌛ Ese personaje ya se fue. Usa \`" + P + "rw\` para tirar otra vez.");
                }
                const p = lista.find(x => x.id === roll.id);
                if (!p) return responder("⚠️ Ese personaje ya no existe en el catálogo.");
                const actual = duenoDe(g, p.id);
                if (actual) {
                    return responder(`🔒 *${p.nombre}* ya fue reclamado por ${tag(actual)}.`, [actual]);
                }
                g.gacha.reclamados[p.id] = { dueno: senderJid, fecha: ahora };
                delete g.gacha.ventas[p.id];
                guardar();

                const r = rareza(valorActual(g, p));
                let txt = yo.gacha.mensajeClaim
                    ? yo.gacha.mensajeClaim.replace(/\{usuario\}/gi, tag(senderJid)).replace(/\{personaje\}/gi, p.nombre)
                    : `🎉 ${tag(senderJid)} reclamó a *${p.nombre}*`;
                txt += `\n${r.icono} *${r.nombre}* · ${dinero(valorActual(g, p))} 🪙`;
                return responder(txt, [senderJid]);
            }

            // ═════════ COLECCIÓN ═════════
            if (accion === "harem") {
                const dueno = objetivoJid || senderJid;
                const ids = misIds(g, dueno)
                    .map(id => lista.find(p => p.id === id)).filter(Boolean)
                    .sort((a, b) => valorActual(g, b) - valorActual(g, a));
                if (ids.length === 0) {
                    return responder(`📭 ${tag(dueno)} todavía no tiene personajes. Usa \`${P}rw\` para empezar.`, [dueno]);
                }
                const total = ids.reduce((s, p) => s + valorActual(g, p), 0);
                const fav = usuarioGrupo(g, dueno).gacha.favorito;
                const { items, pagina, total: paginas } = paginar(ids, Number.isInteger(ultimoNumero) ? ultimoNumero : 1);
                let txt = `╭━━━ 🎴 ❮ ᴄᴏʟᴇᴄᴄɪóɴ ❯ 🎴 ━━━╮\n┃\n`;
                txt += `┃ 👤 ${tag(dueno)}\n┃ 🎴 Personajes: *${ids.length}*\n┃ 💰 Valor total: *${dinero(total)}*\n┃\n`;
                items.forEach((p, i) => {
                    const n = (pagina - 1) * POR_PAGINA + i + 1;
                    txt += `┃ ${p.id === fav ? "⭐" : rareza(p.valor).icono} ${n}. *${p.nombre}* — ${p.serie} · ${dinero(valorActual(g, p))}\n`;
                });
                txt += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n> • Página *${pagina}* de *${paginas}*`;
                const favP = lista.find(p => p.id === fav && duenoDe(g, p.id) === dueno);
                const imgs = favP ? candidatosImagen(favP) : imagenGacha();
                return enviarConImagen(sock, chatId, imgs, txt, [dueno], msg);
            }

            // ═════════ INFO / IMAGEN DE UN PERSONAJE ═════════
            if (accion === "charinfo" || accion === "charimage") {
                const p = buscarPersonaje(lista, textoSinMenciones);
                if (!p) return responder(`⚠️ Uso: \`${P}${cmd} <nombre>\`. No encontré ese personaje.`);
                if (accion === "charimage") {
                    return enviarConImagen(sock, chatId, candidatosImagen(p), `🎴 *${p.nombre}* — ${p.serie}`, [], msg);
                }
                const dueno = duenoDe(g, p.id);
                const venta = g.gacha.ventas[p.id];
                const extra = venta ? `\n⛁ Precio » *${venta.precio}*` : "";
                const txt = ficha(p, valorActual(g, p), dueno ? `Reclamado por ${tag(dueno)}` : "Libre", extra);
                return enviarConImagen(sock, chatId, candidatosImagen(p), txt, dueno ? [dueno] : [], msg);
            }

            // ═════════ VENDER / TIENDA / COMPRAR ═════════
            if (accion === "sell") {
                const precio = parseInt(args[0]);
                const p = buscarPersonaje(lista, args.slice(1).filter(a => !a.startsWith("@")).join(" "));
                if (isNaN(precio) || precio <= 0 || !p) {
                    return responder(`⚠️ Uso: \`${P}sell <precio> <nombre>\`\nEjemplo: \`${P}sell 5000 Kirito\``);
                }
                if (precio > PRECIO_MAX) return responder(`❌ El precio máximo es ${dinero(PRECIO_MAX)}.`);
                if (duenoDe(g, p.id) !== senderJid) return responder("❌ Solo puedes vender personajes que te pertenecen.");
                g.gacha.ventas[p.id] = { precio, vendedor: senderJid };
                guardar();
                return responder(`🏷️ *${p.nombre}* está en venta por *${dinero(precio)}* 🪙. Mira \`${P}haremshop\`.`);
            }

            if (accion === "haremshop") {
                const items = Object.entries(g.gacha.ventas)
                    .map(([id, v]) => ({ p: lista.find(x => x.id === id), v }))
                    .filter(x => x.p && duenoDe(g, x.p.id) === x.v.vendedor)
                    .sort((a, b) => a.v.precio - b.v.precio);
                if (items.length === 0) return responder("🛒 No hay personajes en venta ahora mismo.");
                const { items: pag, pagina, total } = paginar(items, Number.isInteger(ultimoNumero) ? ultimoNumero : 1);
                let txt = `╭━━━ 🛒 ❮ ᴛɪᴇɴᴅᴀ ᴅᴇ ᴘᴇʀꜱᴏɴᴀᴊᴇꜱ ❯ 🛒 ━━━╮\n┃\n`;
                pag.forEach(({ p, v }) => {
                    txt += `┃ ${rareza(p.valor).icono} *${p.nombre}* — ${p.serie}\n┃    💰 ${dinero(v.precio)} · vendedor ${tag(v.vendedor)}\n`;
                });
                txt += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n> • Comprar: \`${P}buyc <nombre>\` · Página *${pagina}* de *${total}*`;
                return responder(txt, pag.map(x => x.v.vendedor));
            }

            if (accion === "buychar") {
                const p = buscarPersonaje(lista, textoSinMenciones);
                if (!p) return responder(`⚠️ Uso: \`${P}buyc <nombre>\``);
                const venta = g.gacha.ventas[p.id];
                if (!venta || duenoDe(g, p.id) !== venta.vendedor) return responder("❌ Ese personaje no está en venta.");
                if (venta.vendedor === senderJid) return responder("❌ No puedes comprar tu propio personaje. Usa \`" + P + "removesale\`.");
                if ((yo.cartera || 0) < venta.precio) {
                    return responder(`❌ No tienes suficiente dinero en tu cartera. Necesitas *${dinero(venta.precio)}*.`);
                }
                const vendedor = usuarioGrupo(g, venta.vendedor);
                yo.cartera -= venta.precio;
                vendedor.cartera = (vendedor.cartera || 0) + venta.precio;
                g.gacha.reclamados[p.id] = { dueno: senderJid, fecha: ahora };
                delete g.gacha.ventas[p.id];
                guardar();
                return responder(`✅ ${tag(senderJid)} compró a *${p.nombre}* por *${dinero(venta.precio)}* 🪙 a ${tag(venta.vendedor)}.`, [senderJid, venta.vendedor]);
            }

            if (accion === "removesale") {
                const p = buscarPersonaje(lista, textoSinMenciones);
                if (!p) return responder(`⚠️ Uso: \`${P}removesale <nombre>\``);
                const venta = g.gacha.ventas[p.id];
                if (!venta) return responder("⚠️ Ese personaje no está en venta.");
                if (venta.vendedor !== senderJid && !esDueno) return responder("❌ Solo el vendedor puede retirarlo de la tienda.");
                delete g.gacha.ventas[p.id];
                guardar();
                return responder(`✅ *${p.nombre}* fue retirado de la tienda.`);
            }

            // ═════════ REGALAR / LIBERAR ═════════
            if (accion === "givechar") {
                if (!objetivoJid || objetivoJid === senderJid) {
                    return responder(`⚠️ Uso: \`${P}givechar @usuario <nombre>\``);
                }
                const p = buscarPersonaje(lista, textoSinMenciones);
                if (!p) return responder("⚠️ No encontré ese personaje. Escribe su nombre después de la mención.");
                if (duenoDe(g, p.id) !== senderJid) return responder("❌ Solo puedes regalar personajes que te pertenecen.");
                g.gacha.reclamados[p.id] = { dueno: objetivoJid, fecha: ahora };
                delete g.gacha.ventas[p.id];
                if (yo.gacha.favorito === p.id) yo.gacha.favorito = null;
                usuarioGrupo(g, objetivoJid);
                guardar();
                return responder(`🎁 ${tag(senderJid)} regaló a *${p.nombre}* a ${tag(objetivoJid)}.`, [senderJid, objetivoJid]);
            }

            if (accion === "giveall") {
                if (!objetivoJid || objetivoJid === senderJid) return responder(`⚠️ Uso: \`${P}giveallharem @usuario confirmar\``);
                const ids = misIds(g, senderJid);
                if (ids.length === 0) return responder("📭 No tienes personajes para regalar.");
                if (norm(args[args.length - 1]) !== "confirmar") {
                    return responder(`⚠️ Vas a regalar *${ids.length}* personajes a ${tag(objetivoJid)}. Si estás seguro escribe:\n\`${P}giveallharem @usuario confirmar\``, [objetivoJid]);
                }
                for (const id of ids) {
                    g.gacha.reclamados[id] = { dueno: objetivoJid, fecha: ahora };
                    delete g.gacha.ventas[id];
                }
                yo.gacha.favorito = null;
                usuarioGrupo(g, objetivoJid);
                guardar();
                return responder(`🎁 ${tag(senderJid)} regaló *${ids.length}* personajes a ${tag(objetivoJid)}.`, [senderJid, objetivoJid]);
            }

            if (accion === "delchar") {
                const p = buscarPersonaje(lista, textoSinMenciones);
                if (!p) return responder(`⚠️ Uso: \`${P}delchar <nombre>\``);
                if (duenoDe(g, p.id) !== senderJid) return responder("❌ Ese personaje no te pertenece.");
                delete g.gacha.reclamados[p.id];
                delete g.gacha.ventas[p.id];
                if (yo.gacha.favorito === p.id) yo.gacha.favorito = null;
                guardar();
                return responder(`🗑️ Liberaste a *${p.nombre}*. Vuelve a estar disponible para todos (sin reembolso).`);
            }

            // ═════════ FAVORITO ═════════
            if (accion === "setfav") {
                const p = buscarPersonaje(lista, textoSinMenciones);
                if (!p) return responder(`⚠️ Uso: \`${P}setfav <nombre>\``);
                if (duenoDe(g, p.id) !== senderJid) return responder("❌ Solo puedes elegir como favorito a un personaje tuyo.");
                yo.gacha.favorito = p.id;
                guardar();
                return responder(`⭐ *${p.nombre}* es ahora tu personaje favorito.`);
            }
            if (accion === "delfav") {
                yo.gacha.favorito = null;
                guardar();
                return responder("✅ Quitaste tu personaje favorito.");
            }
            if (accion === "favtop") {
                const conteo = {};
                for (const u of Object.values(g.usuarios)) {
                    const f = u.gacha?.favorito;
                    if (f) conteo[f] = (conteo[f] || 0) + 1;
                }
                const orden = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, POR_PAGINA);
                if (orden.length === 0) return responder("📭 Nadie ha elegido favoritos todavía.");
                let txt = `╭━━━ ⭐ ❮ ꜰᴀᴠᴏʀɪᴛᴏꜱ ❯ ⭐ ━━━╮\n┃\n`;
                orden.forEach(([id, n], i) => {
                    const p = lista.find(x => x.id === id);
                    if (p) txt += `┃ ${i + 1}. *${p.nombre}* — ${p.serie} · ⭐ ${n}\n`;
                });
                txt += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                return responder(txt);
            }

            // ═════════ TOP / INFO / VOTO ═════════
            if (accion === "top") {
                const orden = [...lista].sort((a, b) => valorActual(g, b) - valorActual(g, a));
                const { items, pagina, total } = paginar(orden, Number.isInteger(ultimoNumero) ? ultimoNumero : 1);
                let txt = `╭━━━ 🏆 ❮ ᴛᴏᴘ ᴅᴇ ᴘᴇʀꜱᴏɴᴀᴊᴇꜱ ❯ 🏆 ━━━╮\n┃\n`;
                const menciones = [];
                items.forEach((p, i) => {
                    const dueno = duenoDe(g, p.id);
                    if (dueno) menciones.push(dueno);
                    txt += `┃ ${(pagina - 1) * POR_PAGINA + i + 1}. ${rareza(p.valor).icono} *${p.nombre}* · ${dinero(valorActual(g, p))}\n┃    ${dueno ? "🔒 " + tag(dueno) : "🟢 Libre"}\n`;
                });
                txt += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n> • Página *${pagina}* de *${total}*`;
                return enviarConImagen(sock, chatId, imagenGacha(), txt, menciones, msg);
            }

            if (accion === "info") {
                const mios = misIds(g, senderJid).map(id => lista.find(p => p.id === id)).filter(Boolean);
                const valor = mios.reduce((s, p) => s + valorActual(g, p), 0);
                const faltaRoll = yo.gacha.ultimoRoll + CD.roll - ahora;
                const faltaVoto = yo.gacha.ultimoVoto + CD.voto - ahora;
                const fav = lista.find(p => p.id === yo.gacha.favorito);
                const enVenta = Object.entries(g.gacha.ventas).filter(([id, v]) => v.vendedor === senderJid && duenoDe(g, id) === senderJid).length;
                let txt = `╭━━━ 🎴 ❮ ɪɴꜰᴏ ɢᴀᴄʜᴀ ❯ 🎴 ━━━╮\n┃\n`;
                txt += `┃ 👤 ${tag(senderJid)}\n┃ 🎴 Personajes » *${mios.length}* de ${lista.length}\n`;
                txt += `┃ 💰 Valor total » *${dinero(valor)}*\n┃ 🏷️ En venta » *${enVenta}*\n`;
                txt += `┃ ⭐ Favorito » *${fav ? fav.nombre : "Ninguno"}*\n`;
                txt += `┃ 🎲 Próxima tirada » *${faltaRoll > 0 ? fmt(faltaRoll) : "¡Lista!"}*\n`;
                txt += `┃ 🗳️ Próximo voto » *${faltaVoto > 0 ? fmt(faltaVoto) : "¡Listo!"}*\n┃\n`;
                txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                return enviarConImagen(sock, chatId, imagenGacha(), txt, [senderJid], msg);
            }

            if (accion === "vote") {
                const p = buscarPersonaje(lista, textoSinMenciones);
                if (!p) return responder(`⚠️ Uso: \`${P}vote <nombre>\``);
                const falta = yo.gacha.ultimoVoto + CD.voto - ahora;
                if (falta > 0) return responder(`⏳ Ya votaste. Podrás votar de nuevo en *${fmt(falta)}*.`);
                yo.gacha.ultimoVoto = ahora;
                g.gacha.votos[p.id] = (g.gacha.votos[p.id] || 0) + 1;
                guardar();
                return responder(`🗳️ Votaste por *${p.nombre}*. Su valor ahora es *${dinero(valorActual(g, p))}* 🪙.`);
            }

            // ═════════ SERIES ═════════
            if (accion === "serielist") {
                const conteo = {};
                for (const p of lista) conteo[p.serie] = (conteo[p.serie] || 0) + 1;
                const orden = Object.entries(conteo).sort((a, b) => a[0].localeCompare(b[0]));
                const { items, pagina, total } = paginar(orden, Number.isInteger(ultimoNumero) ? ultimoNumero : 1);
                let txt = `╭━━━ 📺 ❮ ꜱᴇʀɪᴇꜱ ❯ 📺 ━━━╮\n┃\n`;
                items.forEach(([s, n]) => { txt += `┃ ✦ *${s}* — ${n} personaje(s)\n`; });
                txt += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n> • Página *${pagina}* de *${total}* · \`${P}serieinfo <nombre>\``;
                return responder(txt);
            }

            if (accion === "serieinfo") {
                const q = norm(textoSinMenciones);
                if (!q) return responder(`⚠️ Uso: \`${P}serieinfo <nombre de la serie>\``);
                const personajes = lista.filter(p => norm(p.serie).includes(q)).sort((a, b) => b.valor - a.valor);
                if (personajes.length === 0) return responder("⚠️ No encontré esa serie.");
                let txt = `╭━━━ 📺 ❮ ${personajes[0].serie} ❯ 📺 ━━━╮\n┃\n`;
                const menciones = [];
                personajes.slice(0, 20).forEach(p => {
                    const d = duenoDe(g, p.id);
                    if (d) menciones.push(d);
                    txt += `┃ ${rareza(p.valor).icono} *${p.nombre}* · ${dinero(valorActual(g, p))} · ${d ? tag(d) : "🟢 Libre"}\n`;
                });
                txt += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                return responder(txt, menciones);
            }

            // ═════════ COOLDOWNS: VER, CAMBIAR Y REINICIAR ═════════
            if (accion === "cooldowns") {
                const quien = objetivoJid || senderJid;
                const u = quien === senderJid ? yo : (g.usuarios[quien] || {});
                const gu = u.gacha || {};
                const estado = (falta) => (falta > 0 ? `⏳ ${fmt(falta)}` : "✅ Lista");
                let txt = `⏱️ *Cooldowns de ${tag(quien)}*\n\n🎴 *Gacha*\n`;
                txt += `• Tirar » ${estado((gu.ultimoRoll || 0) + CD.roll - ahora)}  _(cada ${fmt(CD.roll)})_\n`;
                txt += `• Votar » ${estado((gu.ultimoVoto || 0) + CD.voto - ahora)}  _(cada ${fmt(CD.voto)})_\n`;
                const rollActivo = g.gacha.ultimoRoll;
                const quedan = rollActivo ? rollActivo.ts + CD.claim - ahora : 0;
                const pj = rollActivo && lista.find(x => x.id === rollActivo.id);
                txt += `• Reclamar » ${pj && quedan > 0 && !duenoDe(g, pj.id) ? `🟢 *${pj.nombre}* (quedan ${fmt(quedan)})` : "Sin personaje activo"}  _(ventana de ${fmt(CD.claim)})_\n`;

                txt += `\n💰 *Economía*\n`;
                txt += `• Diario » ${estado((u.ultimoDiario || 0) + DIA - ahora)}  _(cada 24h)_\n`;
                txt += `• Crimen » ${estado((u.ultimoCrimen || 0) + 8 * MIN - ahora)}  _(cada 8m)_\n`;
                txt += `• Estafa » ${estado((u.ultimaEstafa || 0) + 10 * MIN - ahora)}  _(cada 10m)_\n`;
                txt += `• Robo » ${estado((u.cooldownRobo || 0) - ahora)}  _(10m tras un fallo)_\n`;
                txt += `• Trabajo » ${(u.trabajoActivoHasta || 0) > ahora ? `⏳ ${fmt(u.trabajoActivoHasta - ahora)} (en turno)` : "✅ Libre"}\n`;
                if (u.ultimoRecoleccionNegocios) txt += `• Negocios » ${estado(u.ultimoRecoleccionNegocios + HORA - ahora)}  _(ciclo de 1h)_\n`;
                txt += `\n> ⚙️ El dueño cambia los tiempos del gacha con \`${P}setcd\`.`;
                return responder(txt, [quien]);
            }

            if (accion === "setcd") {
                const mostrar = (cd = CD) => {
                    let txt = `⚙️ *Tiempos del gacha*\n\n`;
                    for (const k of Object.keys(CD_DEFECTO)) {
                        const cambiado = cd[k] !== CD_DEFECTO[k];
                        txt += `• *${k}* — ${CD_NOMBRES[k]}: *${fmt(cd[k])}*${cambiado ? `  _(por defecto ${fmt(CD_DEFECTO[k])})_` : ""}\n`;
                    }
                    txt += `\n> Cambiar (dueño): \`${P}setcd roll 10m\` · \`${P}setcd claim 30s\` · \`${P}setcd voto 12h\`\n> Volver a los de fábrica: \`${P}setcd reset\`\n> Unidades: s, m, h, d (puedes combinar: 1h30m).`;
                    return txt;
                };
                if (args.length === 0) return responder(mostrar());
                if (!esDueno) return responder("❌ Solo el dueño del bot puede cambiar los tiempos.");
                if (!db.global) db.global = {};

                if (norm(args[0]) === "reset") {
                    delete db.global.gachaCooldowns;
                    guardar();
                    return responder("✅ Tiempos restablecidos a los de fábrica.\n\n" + mostrar({ ...CD_DEFECTO }));
                }
                const clave = CD_ALIAS[norm(args[0])];
                if (!clave || args.length < 2) {
                    return responder(`⚠️ Uso: \`${P}setcd <roll | claim | voto> <tiempo>\`\nEjemplos: \`${P}setcd roll 10m\`, \`${P}setcd claim 45s\`, \`${P}setcd voto 12h\`\nTambién: \`${P}setcd reset\``);
                }
                const ms = parseTiempo(args.slice(1).join(""));
                if (ms === null) return responder("⚠️ No entendí el tiempo. Usa números con unidad: *30s*, *5m*, *2h*, *1d* o combinado como *1h30m*.");
                const [min, max] = CD_LIMITES[clave];
                if (ms < min || ms > max) {
                    return responder(`⚠️ Para *${clave}* el tiempo debe estar entre *${fmt(min)}* y *${fmt(max)}*${min === 0 ? " (0s lo desactiva)" : ""}.`);
                }
                const antes = CD[clave];
                if (!db.global.gachaCooldowns) db.global.gachaCooldowns = {};
                db.global.gachaCooldowns[clave] = ms;
                guardar();
                return responder(`✅ *${CD_NOMBRES[clave]}*: ${fmt(antes)} → *${fmt(ms)}*\nAplica ya, en todos los grupos.`);
            }

            if (accion === "cdreset") {
                if (!esDueno) return responder("❌ Solo el dueño del bot puede reiniciar cooldowns.");
                if (norm(args[0]) === "all" || norm(args[0]) === "todos") {
                    let n = 0;
                    for (const u of Object.values(g.usuarios)) if (u.gacha) { u.gacha.ultimoRoll = 0; u.gacha.ultimoVoto = 0; n++; }
                    guardar();
                    return responder(`✅ Cooldowns del gacha reiniciados para *${n}* usuarios de este grupo.`);
                }
                const quien = objetivoJid || senderJid;
                const u = quien === senderJid ? yo : g.usuarios[quien];
                if (!u?.gacha) return responder("⚠️ Ese usuario todavía no ha usado el gacha.");
                u.gacha.ultimoRoll = 0;
                u.gacha.ultimoVoto = 0;
                guardar();
                return responder(`✅ Cooldowns del gacha de ${tag(quien)} reiniciados: ya puede tirar y votar.`, [quien]);
            }

            // ═════════ MENSAJE DE RECLAMO ═════════
            if (accion === "setclaimmsg") {
                const texto = args.join(" ").replace(/\s+/g, " ").trim().slice(0, 150);
                if (!texto) return responder(`⚠️ Uso: \`${P}setclaimmsg <texto>\`\nPuedes usar {usuario} y {personaje}.`);
                yo.gacha.mensajeClaim = texto;
                guardar();
                return responder("✅ Mensaje de reclamo actualizado.");
            }
            if (accion === "delclaimmsg") {
                yo.gacha.mensajeClaim = null;
                guardar();
                return responder("✅ Mensaje de reclamo restablecido.");
            }

            // ═════════ ADMINISTRACIÓN (solo dueño) ═════════
            if (accion === "addchar" || accion === "setcharimg") {
                if (!esDueno) return responder("❌ Solo el dueño del bot puede usar este comando.");

                // La imagen puede venir adjunta, citada o como enlace directo
                const citado = ctx?.quotedMessage;
                const imageMessage = msg.message?.imageMessage || citado?.imageMessage;
                const esUrl = (t) => /^https?:\/\//i.test(t || "");
                const guardarImagen = async (id, url) => {
                    let buffer, ext = "jpg";
                    if (imageMessage) {
                        const { downloadMediaMessage } = await import("@whiskeysockets/baileys");
                        buffer = await downloadMediaMessage({ message: { imageMessage } }, "buffer", {}, { logger: console, reuploadRequest: sock.updateMediaMessage });
                        const mime = String(imageMessage.mimetype || "");
                        ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
                    } else if (esUrl(url)) {
                        ({ buffer, ext } = await descargarImagen(url));
                    } else {
                        return false;
                    }
                    fs.mkdirSync(DIR_PERSONAJES, { recursive: true });
                    for (const e of ["jpg", "jpeg", "png", "webp"]) { try { fs.unlinkSync(path.join(DIR_PERSONAJES, `${id}.${e}`)); } catch { /* no existía */ } }
                    fs.writeFileSync(path.join(DIR_PERSONAJES, `${id}.${ext}`), buffer);
                    return true;
                };

                if (accion === "setcharimg") {
                    const url = args.find(esUrl);
                    const p = buscarPersonaje(lista, args.filter(a => !a.startsWith("@") && !esUrl(a)).join(" "));
                    if (!p) return responder(`⚠️ Uso: envía una foto con el texto \`${P}setcharimg <nombre>\`, o usa un enlace:\n\`${P}setcharimg <nombre> https://sitio.com/foto.jpg\``);
                    if (!imageMessage && !url) return responder("⚠️ Falta la imagen: adjunta una foto o agrega un enlace directo.");
                    try {
                        await guardarImagen(p.id, url);
                    } catch (e) {
                        return responder(`❌ No pude guardar la imagen: ${e.message}.`);
                    }
                    return responder(`✅ Imagen de *${p.nombre}* actualizada.`);
                }

                // addchar Nombre | Serie | valor | genero | enlace(opcional)
                const partes = args.join(" ").split("|").map(s => s.trim());
                const [nombre, serie, valorTxt, genero, urlTxt] = partes;
                const valor = parseInt(valorTxt);
                if (!nombre || !serie || isNaN(valor) || valor <= 0) {
                    return responder(`⚠️ Uso: \`${P}addchar Nombre | Serie | valor | genero | enlace\`\nEl género y el enlace son opcionales; también puedes adjuntar una foto.\nEjemplo: \`${P}addchar Rem | Re:Zero | 700 | mujer\``);
                }
                let id = slug(nombre), n = 2;
                while (lista.some(p => p.id === id)) id = `${slug(nombre)}-${n++}`;
                guardarPersonajes([...lista, { id, nombre, serie, genero: norm(genero) || "otro", valor, img: [] }]);

                let estadoImg = "por defecto (usa \`" + P + "setcharimg " + nombre + "\` para cambiarla)";
                try {
                    if (await guardarImagen(id, urlTxt)) estadoImg = "guardada";
                } catch (e) {
                    estadoImg = `por defecto (no pude guardar la que enviaste: ${e.message})`;
                }
                return responder(`✅ Personaje agregado: *${nombre}* (${serie}) · ${dinero(valor)}\n🖼️ Imagen: ${estadoImg}`);
            }
        } catch (e) {
            console.error(`❌ Error en plugin gacha (${cmd}):`, e);
            return sock.sendMessage(chatId, { text: "❌ Ocurrió un error en el gacha. Intenta de nuevo." }, { quoted: msg }).catch(() => {});
        }
    }
};
