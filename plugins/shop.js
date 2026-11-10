import fs from "fs";
import path from "path";

const HORA = 60 * 60 * 1000;
// XP necesaria para pasar del nivel actual al siguiente (cámbiala si quieres otra curva)
const xpParaSubir = (nivel) => 100 * nivel;
// Categorías donde solo se compra 1 unidad a la vez
const UNO_SOLO = ["armas", "vehiculos", "gacha"];

function leerConfig() {
    try {
        const ruta = path.resolve("config_juego.json");
        if (fs.existsSync(ruta)) return JSON.parse(fs.readFileSync(ruta, "utf8"));
    } catch (e) {
        console.error("Error al leer config_juego.json en shop:", e.message);
    }
    return {};
}

const nombreDe = (i) => (typeof i === "string" ? i : (i?.nombre || i?.name || "Objeto"));
const precioDe = (i) => Number(i?.precio ?? i?.price ?? 0) || 0;

// Paga a la cartera las horas completas que los negocios actuales ya produjeron
function liquidarNegocios(uGrupo, negociosTienda, ahora) {
    const ult = uGrupo.ultimoRecoleccionNegocios || 0;
    if (!ult || !uGrupo.negocios) return 0;
    const horas = Math.floor((ahora - ult) / HORA);
    if (horas < 1) return 0;
    let porHora = 0;
    for (const [nombre, cant] of Object.entries(uGrupo.negocios)) {
        if (!(cant > 0)) continue;
        const data = negociosTienda.find(n => String(n.nombre).toLowerCase() === nombre.toLowerCase());
        if (data) porHora += (data.gananciaHora || 150) * cant;
    }
    const total = porHora * horas;
    if (total > 0) {
        uGrupo.cartera = (uGrupo.cartera || 0) + total;
        uGrupo.ultimoRecoleccionNegocios = ult + horas * HORA; // conserva el sobrante
    }
    return total;
}

export default {
    name: "shop",
    description: "Tienda por categorías (JSON): guardias, armas, vehículos, libros, negocios y gacha",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        const cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["shop", "tienda"].includes(cmdLimpio)) return;

        if (!chatId.endsWith("@g.us")) {
            return sock.sendMessage(chatId, { text: "⚠️ Este comando debe usarse dentro de un grupo." }, { quoted: msg });
        }

        // --- Inicialización segura de la DB ---
        db.global = db.global || {};
        db.grupos = db.grupos || {};
        db.grupos[chatId] = db.grupos[chatId] || {};
        db.grupos[chatId].usuarios = db.grupos[chatId].usuarios || {};
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0, guardianHasta: 0, inventario: [] };
        }
        const uGrupo = db.grupos[chatId].usuarios[senderJid];
        uGrupo.cartera = uGrupo.cartera || 0;
        if (!Array.isArray(uGrupo.inventario)) uGrupo.inventario = [];

        const tiendaData = leerConfig().tienda || {};
        const categorias = Object.keys(tiendaData).filter(cat => Array.isArray(tiendaData[cat]) && tiendaData[cat].length > 0);

        const tiene = (nombre) => uGrupo.inventario.some(i => nombreDe(i).toLowerCase() === nombre.toLowerCase());

        const infoExtra = (cat, item) => {
            const nombre = nombreDe(item);
            if (cat === "guardias") return ` | Protección: ${item.tiempoProteccion || 24}h`;
            if (cat === "armas" || cat === "vehiculos") return ` | Bono crimen: +${item.bonoCrimen || 0}%${tiene(nombre) ? " | ✅ Comprado" : ""}`;
            if (cat === "libros") return ` | XP: +${item.xp || 0}`;
            if (cat === "negocios") {
                const mios = uGrupo.negocios && uGrupo.negocios[nombre] ? ` | Tienes: ${uGrupo.negocios[nombre]}` : "";
                return ` | Ganancia: ${formatoMoneda(item.gananciaHora || 150)}/h${mios}`;
            }
            if (cat === "gacha") return item.descripcion ? ` | ${item.descripcion}` : "";
            return "";
        };

        const arg1 = (args[0] || "").toLowerCase().trim();
        const arg2 = args[1];
        const arg3 = args[2];

        // 1. Categorías principales
        if (!arg1) {
            if (categorias.length === 0) {
                return sock.sendMessage(chatId, { text: "⚠️ La tienda está vacía. Falta la sección \"tienda\" en config_juego.json." }, { quoted: msg });
            }
            let txt = `「✿」 *ᴛɪᴇɴᴅᴀ ɢᴇɴᴇʀᴀʟ - ᴄᴀᴛᴇɢᴏʀíᴀꜱ*:\n\n`;
            categorias.forEach((cat, i) => {
                txt += `✰ ${i + 1} » *${cat.toUpperCase()}* | Usa \`${prefijoUsado}shop ${cat}\`\n`;
            });
            txt += `\n> • ᴇꜱᴄʀɪʙᴇ \`${prefijoUsado}shop <categoría>\` ᴘᴀʀᴀ ᴠᴇʀ ʟᴏꜱ ᴀʀᴛíᴄᴜʟᴏꜱ.`;
            return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
        }

        let categoria = null;
        if (categorias.includes(arg1)) categoria = arg1;
        else if (/^\d+$/.test(arg1)) {
            const idx = parseInt(arg1) - 1;
            if (idx >= 0 && idx < categorias.length) categoria = categorias[idx];
        }
        if (!categoria) {
            return sock.sendMessage(chatId, { text: `⚠️ Esa categoría no existe. Escribe \`${prefijoUsado}shop\` para ver las disponibles.` }, { quoted: msg });
        }

        const lista = tiendaData[categoria];

        // 2. Artículos de la categoría
        if (!arg2) {
            let txt = `「✿」 *ᴄᴀᴛᴇɢᴏʀíᴀ: ${categoria.toUpperCase()}*:\n\n`;
            lista.forEach((item, i) => {
                txt += `✰ ${i + 1} » *${nombreDe(item)}*${infoExtra(categoria, item)}\n`;
                txt += `\t\t ᴄᴏꜱᴛᴏ » *${formatoMoneda(precioDe(item))}* | Usa \`${prefijoUsado}shop ${categoria} ${i + 1}${UNO_SOLO.includes(categoria) ? "" : " [cantidad]"}\`\n`;
            });
            txt += `\n> • ᴇᴊᴇᴍᴘʟᴏ ᴅᴇ ᴄᴏᴍᴘʀᴀ: \`${prefijoUsado}shop ${categoria} 1${UNO_SOLO.includes(categoria) ? "" : " 1"}\``;
            return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
        }

        // 3. Compra
        const itemIndex = parseInt(arg2) - 1;
        const cantidad = arg3 === undefined ? 1 : parseInt(arg3);
        const responder = (t) => sock.sendMessage(chatId, { text: t }, { quoted: msg });

        if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= lista.length) {
            return responder("⚠️ El número de ítem especificado no es válido en esta categoría.");
        }
        if (isNaN(cantidad) || cantidad <= 0 || cantidad > 1000) {
            return responder("⚠️ Debes indicar una cantidad válida (entre 1 y 1000).");
        }

        const item = lista[itemIndex];
        const nombre = nombreDe(item);

        if (UNO_SOLO.includes(categoria) && cantidad !== 1) {
            return responder("⚠️ De este tipo de artículo solo puedes comprar 1 unidad a la vez.");
        }
        if ((categoria === "armas" || categoria === "vehiculos") && tiene(nombre)) {
            return responder(`⚠️ Ya tienes *${nombre}*. No hace falta comprarlo otra vez.`);
        }
        if (categoria === "gacha" && !["resetRoll", "resetVoto"].includes(item.efecto)) {
            return responder("⚠️ Este artículo de gacha no tiene un efecto válido en config_juego.json.");
        }

        const costoTotal = precioDe(item) * cantidad;
        if (uGrupo.cartera < costoTotal) {
            return responder(`⚠️ No tienes suficiente dinero. Necesitas *${formatoMoneda(costoTotal)}* en tu cartera.`);
        }

        uGrupo.cartera -= costoTotal;
        let mensajeExtra = "";
        const ahora = Date.now();

        if (categoria === "guardias") {
            const totalHoras = (item.tiempoProteccion || 24) * cantidad;
            const duracionMs = totalHoras * HORA;
            uGrupo.guardianHasta = (uGrupo.guardianHasta && uGrupo.guardianHasta > ahora)
                ? uGrupo.guardianHasta + duracionMs
                : ahora + duracionMs;
            mensajeExtra = `\n> ❖ ᴘʀᴏᴛᴇᴄᴄɪóɴ » _Tu cartera está protegida por +${totalHoras} horas en total_`;

        } else if (categoria === "libros") {
            const xpGanada = (Number(item.xp) || 0) * cantidad;
            uGrupo.xp = (uGrupo.xp || 0) + xpGanada;
            uGrupo.nivel = uGrupo.nivel || 1;
            let subidas = 0;
            while (uGrupo.xp >= xpParaSubir(uGrupo.nivel) && subidas < 1000) {
                uGrupo.xp -= xpParaSubir(uGrupo.nivel);
                uGrupo.nivel++;
                subidas++;
            }
            mensajeExtra = `\n> ❖ ᴇxᴘᴇʀɪᴇɴᴄɪᴀ » _+${xpGanada} XP${subidas ? ` · ¡Subiste al nivel ${uGrupo.nivel}!` : ""} (${uGrupo.xp}/${xpParaSubir(uGrupo.nivel)})_`;

        } else if (categoria === "negocios") {
            const negociosTienda = tiendaData.negocios || [];
            const cobrado = liquidarNegocios(uGrupo, negociosTienda, ahora);
            const teniaNegocios = Object.values(uGrupo.negocios || {}).some(c => c > 0);
            if (!uGrupo.negocios || typeof uGrupo.negocios !== "object" || Array.isArray(uGrupo.negocios)) uGrupo.negocios = {};
            if (!teniaNegocios || !uGrupo.ultimoRecoleccionNegocios) uGrupo.ultimoRecoleccionNegocios = ahora;
            uGrupo.negocios[nombre] = (uGrupo.negocios[nombre] || 0) + cantidad;
            mensajeExtra = `\n> ❖ ɴᴇɢᴏᴄɪᴏ » _Produce ${formatoMoneda((item.gananciaHora || 150) * cantidad)}/h. Cobra con ${prefijoUsado}recolectar_`;
            if (cobrado > 0) mensajeExtra += `\n> ❖ ᴄᴏʙʀᴏ » _Se liquidaron ${formatoMoneda(cobrado)} que tus negocios ya habían producido_`;

        } else if (categoria === "gacha") {
            if (!uGrupo.gacha) uGrupo.gacha = { ultimoRoll: 0, favorito: null, ultimoVoto: 0, mensajeClaim: null };
            if (item.efecto === "resetRoll") {
                uGrupo.gacha.ultimoRoll = 0;
                mensajeExtra = `\n> ❖ ɢᴀᴄʜᴀ » _Tu cooldown de tirada se reinició: usa ${prefijoUsado}rw_`;
            } else {
                uGrupo.gacha.ultimoVoto = 0;
                mensajeExtra = `\n> ❖ ɢᴀᴄʜᴀ » _Tu cooldown de voto se reinició: usa ${prefijoUsado}vote_`;
            }

        } else {
            // Armas, vehículos y cualquier otra categoría: al inventario
            const existente = uGrupo.inventario.find(i => nombreDe(i).toLowerCase() === nombre.toLowerCase());
            if (existente && typeof existente === "object") existente.cantidad = (existente.cantidad || 1) + cantidad;
            else uGrupo.inventario.push({ ...item, categoria, cantidad });

            if (categoria === "armas" || categoria === "vehiculos") {
                mensajeExtra = `\n> ❖ ʙᴏɴᴏ » _+${item.bonoCrimen || 0}% de éxito en crímenes (hasta el tope)_`;
            }
        }

        guardarDB();

        let txt = `╭━━━ 🅲 ❮ ᴄᴏᴍᴘʀᴀ ᴇxɪᴛᴏꜱᴀ ❯ 🅲 ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ ✰ ᴀʀᴛíᴄᴜʟᴏ » *${cantidad}x ${nombre}*\n`;
        txt += `┃ ❖ ᴄᴀᴛᴇɢᴏʀíᴀ » *${categoria.toUpperCase()}*\n`;
        txt += `┃ ✦ ᴄᴏꜱᴛᴏ ᴛᴏᴛᴀʟ » *${formatoMoneda(costoTotal)}*\n`;
        txt += `┃\n`;
        txt += `> ❀ ᴇꜱᴛᴀᴅᴏ » _Transacción registrada en el sistema_${mensajeExtra}\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }
};
