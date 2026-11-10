import fs from "fs";
import { generarImagenAhorcado } from "./ahorcadoImage.js";
import { elegirPalabra } from "./ahorcadoPalabras.js";

// Minúsculas, sin tildes (conserva la ñ)
function normalizar(s) {
    return String(s || "").toLowerCase().trim().split("")
        .map(c => (c === "ñ" ? c : c.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
        .join("");
}

const esLetra = (c) => /^[a-zñ]$/.test(c);

function palabraCompleta(juego) {
    return juego.clave.split("").every(c => !esLetra(c) || juego.letrasAdivinadas.includes(c));
}

function progresoTexto(juego) {
    return juego.clave.split("").map(c => {
        if (!esLetra(c)) return c === " " ? "  " : c;
        return juego.letrasAdivinadas.includes(c) ? c.toUpperCase() : "_";
    }).join(" ");
}

function captionEstado(juego, prefijo) {
    let txt = `🎯 *JUEGO DEL AHORCADO*\n\n`;
    txt += `💡 Pista: *${juego.pista}*\n`;
    txt += `🔤 Letras: *${juego.clave.replace(/[^a-zñ]/g, "").length}*\n`;
    txt += `❤️ Intentos: *${juego.intentosRestantes} / ${juego.intentosMaximos}*\n`;
    txt += `❌ Fallidas: ${juego.letrasErroneas.join(", ").toUpperCase() || "Ninguna"}\n\n`;
    txt += `> 💡 _Usa_ \`${prefijo}a <letra>\` _o_ \`${prefijo}a <palabra>\` _para adivinar._`;
    return txt;
}

async function enviarTablero(sock, chatId, msg, juego, caption, mentions = [], final = null) {
    let ruta = null;
    const opciones = msg ? { quoted: msg } : {};
    try {
        ruta = await generarImagenAhorcado({
            palabra: juego.clave,
            letrasAdivinadas: juego.letrasAdivinadas,
            letrasErroneas: juego.letrasErroneas,
            intentosRestantes: juego.intentosRestantes,
            intentosMaximos: juego.intentosMaximos,
            final
        });
        await sock.sendMessage(chatId, { image: { url: ruta }, caption, mentions }, opciones);
    } catch (e) {
        console.error("❌ Error generando/enviando el tablero del ahorcado:", e.message);
        await sock.sendMessage(chatId, { text: `🔤 ${progresoTexto(juego)}\n\n${caption}`, mentions }, opciones);
    } finally {
        if (ruta) { try { fs.unlinkSync(ruta); } catch {} }
    }
}

export default {
    name: "ahorcado",
    description: "Juego del ahorcado local por grupo con premios locales, pistas e imagen generada con Jimp",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        const cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["ahorcado", "hangman", "a"].includes(cmdLimpio)) return;

        const tag = (jid) => typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(jid) : "@" + jid.split("@")[0];

        // 🛡️ Solo en grupos
        if (!chatId.endsWith("@g.us")) {
            if (cmdLimpio === "a") return;
            return sock.sendMessage(chatId, { text: "⚠️ El juego del ahorcado solo se puede jugar dentro de los grupos." }, { quoted: msg });
        }

        if (!global.partidasAhorcado) global.partidasAhorcado = {};

        // ================= INICIAR PARTIDA =================
        if (["ahorcado", "hangman"].includes(cmdLimpio)) {
            if (global.partidasAhorcado[chatId] && global.partidasAhorcado[chatId].activo) {
                return sock.sendMessage(chatId, { text: "⚠️ ¡Ya hay una partida de Ahorcado en curso en este grupo!" }, { quoted: msg });
            }

            const seleccion = elegirPalabra(chatId);

            global.partidasAhorcado[chatId] = {
                activo: true,
                palabra: seleccion.palabra,
                clave: normalizar(seleccion.palabra),
                pista: seleccion.pista,
                letrasAdivinadas: [],
                intentosMaximos: 6,
                intentosRestantes: 6,
                letrasErroneas: []
            };

            return enviarTablero(sock, chatId, msg, global.partidasAhorcado[chatId], captionEstado(global.partidasAhorcado[chatId], prefijoUsado));
        }

        // ================= ADIVINAR (.a) =================
        if (cmdLimpio === "a") {
            const juego = global.partidasAhorcado[chatId];
            if (!juego || !juego.activo) {
                return sock.sendMessage(chatId, { text: `❌ No hay ninguna partida de Ahorcado activa en este grupo. Inicia una con \`${prefijoUsado}ahorcado\`` }, { quoted: msg });
            }

            const intentoOriginal = (args || []).join(" ").trim();
            const intento = normalizar(intentoOriginal);
            if (!intento) {
                return sock.sendMessage(chatId, { text: `⚠️ Debes escribir una letra o palabra.\nEjemplo: \`${prefijoUsado}a m\` o \`${prefijoUsado}a moneda\`` }, { quoted: msg });
            }

            // Inicialización segura de la DB del grupo
            db.global = db.global || {};
            db.grupos = db.grupos || {};
            db.grupos[chatId] = db.grupos[chatId] || {};
            db.grupos[chatId].usuarios = db.grupos[chatId].usuarios || {};
            if (!db.grupos[chatId].usuarios[senderJid]) {
                db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
            }
            const uGrupo = db.grupos[chatId].usuarios[senderJid];

            const premiar = () => {
                const premio = juego.clave.replace(/[^a-zñ]/g, "").length * 150;
                uGrupo.cartera = (uGrupo.cartera || 0) + premio;
                if (typeof guardarDB === "function") guardarDB();
                return premio;
            };

            const terminarGanado = async (titulo) => {
                const premio = premiar();
                let cap = `🎉 *VICTORIA EN EL AHORCADO*\n\n${titulo} ${tag(senderJid)}\n`;
                cap += `🔤 Palabra secreta: *${juego.palabra.toUpperCase()}*\n`;
                cap += `🪙 *Premio local (Grupo):* +${formatoMoneda(premio)}`;
                delete global.partidasAhorcado[chatId];
                return enviarTablero(sock, chatId, msg, juego, cap, [senderJid], "ganado");
            };

            const terminarPerdido = async (motivo) => {
                const cap = `💀 *JUEGO TERMINADO*\n\n❌ ${motivo}\n🔤 La palabra secreta era: *${juego.palabra.toUpperCase()}*`;
                delete global.partidasAhorcado[chatId];
                return enviarTablero(sock, chatId, msg, juego, cap, [], "perdido");
            };

            // --- Intento de palabra completa ---
            if (intento.length > 1) {
                if (intento === juego.clave) {
                    return terminarGanado("👑 Ganador:");
                }
                juego.intentosRestantes--;
                if (juego.intentosRestantes <= 0) {
                    return terminarPerdido("¡Se acabaron los intentos en este grupo!");
                }
                return enviarTablero(sock, chatId, msg, juego, `❌ ¡Palabra incorrecta! Te quedan *${juego.intentosRestantes} intentos*.\n\n` + captionEstado(juego, prefijoUsado));
            }

            // --- Intento de letra ---
            const l = intento[0];
            if (!esLetra(l)) {
                return sock.sendMessage(chatId, { text: "⚠️ Escribe una letra válida (A-Z)." }, { quoted: msg });
            }

            if (juego.letrasAdivinadas.includes(l) || juego.letrasErroneas.includes(l)) {
                return sock.sendMessage(chatId, { text: `⚠️ Ya intentaron con la letra *${l.toUpperCase()}*. Prueben otra.` }, { quoted: msg });
            }

            if (juego.clave.includes(l)) {
                juego.letrasAdivinadas.push(l);
                if (palabraCompleta(juego)) {
                    return terminarGanado("👑 ¡Palabra completada por");
                }
                return enviarTablero(sock, chatId, msg, juego, captionEstado(juego, prefijoUsado));
            }

            juego.letrasErroneas.push(l);
            juego.intentosRestantes--;

            if (juego.intentosRestantes <= 0) {
                return terminarPerdido("¡Se acabaron los intentos! El monigote fue ahorcado.");
            }
            return enviarTablero(sock, chatId, msg, juego, captionEstado(juego, prefijoUsado));
        }
    }
};
