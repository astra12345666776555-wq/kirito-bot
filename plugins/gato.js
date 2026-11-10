import fs from "fs";
import { generarImagenTablero } from "./gatoImage.js";

const COMANDOS = ["gato", "ttt", "tresenraya", "aceptar", "rechazar"];

function tableroTexto(t) {
    return t.map(f => f.join("")).join("\n");
}

async function enviarTablero(sock, chatId, msg, tablero, caption, mentions) {
    let ruta = null;
    try {
        ruta = await generarImagenTablero(tablero);
        await sock.sendMessage(chatId, { image: { url: ruta }, caption, mentions }, { quoted: msg });
    } catch (e) {
        console.error("❌ Error generando/enviando el tablero:", e.message);
        await sock.sendMessage(chatId, { text: tableroTexto(tablero) + "\n\n" + caption, mentions }, { quoted: msg });
    } finally {
        if (ruta) { try { fs.unlinkSync(ruta); } catch {} }
    }
}

export default {
    name: "gato",
    description: "Juego de Tres en Raya (Gato) con generación de imágenes locales por Jimp",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        const cmdLimpio = (comando || "").toLowerCase().trim();
        if (!COMANDOS.includes(cmdLimpio)) return;

        const tag = (jid) => typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(jid) : "@" + jid.split("@")[0];

        if (!chatId.endsWith("@g.us")) {
            return sock.sendMessage(chatId, { text: "⚠️ El Tres en Raya (Gato) solo se puede jugar dentro de los grupos." }, { quoted: msg });
        }

        // --- Inicialización segura de la DB ---
        db.global = db.global || {};
        db.grupos = db.grupos || {};
        db.grupos[chatId] = db.grupos[chatId] || {};
        db.grupos[chatId].usuarios = db.grupos[chatId].usuarios || {};

        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }
        const uGrupoSender = db.grupos[chatId].usuarios[senderJid];

        // --- Bloqueo por horario de trabajo ---
        const ahora = Date.now();
        if (uGrupoSender.trabajoActivoHasta && uGrupoSender.trabajoActivoHasta > ahora) {
            const jefe = uGrupoSender.jefeTrabajo || "tu jefe";
            return sock.sendMessage(chatId, { text: `❌ *¡ESTÁS EN HORARIO DE TRABAJO!* 👔\nTu jefe *${jefe}* te descubrió intentando jugar al gato en pleno turno.` }, { quoted: msg });
        }

        if (!global.partidasGato) global.partidasGato = {};

        const partidaActiva = Object.values(global.partidasGato).find(p => p.chatId === chatId && (p.jugadorX === senderJid || p.jugadorO === senderJid));
        const argNum = parseInt(args[0]);

        // --- JUGAR CASILLA (1-9) ---
        if (!isNaN(argNum) && argNum >= 1 && argNum <= 9 && args[0].length === 1 && partidaActiva && partidaActiva.estado === "jugando") {
            if (partidaActiva.turno !== senderJid) {
                return sock.sendMessage(chatId, { text: "⏳ No es tu turno de jugar en esta partida." }, { quoted: msg });
            }

            const index = argNum - 1;
            const fila = Math.floor(index / 3);
            const col = index % 3;

            if (partidaActiva.tablero[fila][col] !== "⬜") {
                return sock.sendMessage(chatId, { text: "⚠️ Esa casilla ya está ocupada. Elige otra." }, { quoted: msg });
            }

            const simbolo = partidaActiva.jugadorX === senderJid ? "❌" : "⭕";
            partidaActiva.tablero[fila][col] = simbolo;

            const t = partidaActiva.tablero;
            let ganador = null;
            for (let i = 0; i < 3; i++) {
                if (t[i][0] !== "⬜" && t[i][0] === t[i][1] && t[i][1] === t[i][2]) ganador = t[i][0];
                if (t[0][i] !== "⬜" && t[0][i] === t[1][i] && t[1][i] === t[2][i]) ganador = t[0][i];
            }
            if (t[0][0] !== "⬜" && t[0][0] === t[1][1] && t[1][1] === t[2][2]) ganador = t[0][0];
            if (t[0][2] !== "⬜" && t[0][2] === t[1][1] && t[1][1] === t[2][0]) ganador = t[0][2];

            if (ganador) {
                partidaActiva.estado = "terminado";
                const idGanador = ganador === "❌" ? partidaActiva.jugadorX : partidaActiva.jugadorO;
                const idPerdedor = ganador === "❌" ? partidaActiva.jugadorO : partidaActiva.jugadorX;

                const uGanador = db.grupos[chatId].usuarios[idGanador];
                const uPerdedor = db.grupos[chatId].usuarios[idPerdedor];

                let caption = `🎮 *GATO · TRES EN RAYA*\n\n🎉 *¡PARTIDA FINALIZADA!*\n🏆 Ganador: ${tag(idGanador)}`;
                if (partidaActiva.apuesta > 0 && uGanador && uPerdedor) {
                    const premio = Math.min(partidaActiva.apuesta, uPerdedor.cartera || 0);
                    uGanador.cartera = (uGanador.cartera || 0) + premio;
                    uPerdedor.cartera = Math.max(0, (uPerdedor.cartera || 0) - premio);
                    if (typeof guardarDB === "function") guardarDB();
                    caption += `\n🪙 Premio: +${formatoMoneda(premio)}`;
                }

                delete global.partidasGato[partidaActiva.id];
                return enviarTablero(sock, chatId, msg, t, caption, [idGanador, idPerdedor]);
            }

            const lleno = t.every(f => f.every(c => c !== "⬜"));
            if (lleno) {
                partidaActiva.estado = "terminado";
                delete global.partidasGato[partidaActiva.id];
                return enviarTablero(sock, chatId, msg, t, "🤝 *EMPATE*\nEl tablero se llenó y nadie ganó.", [partidaActiva.jugadorX, partidaActiva.jugadorO]);
            }

            partidaActiva.turno = partidaActiva.turno === partidaActiva.jugadorX ? partidaActiva.jugadorO : partidaActiva.jugadorX;
            const siguienteSimbolo = partidaActiva.turno === partidaActiva.jugadorX ? "❌" : "⭕";
            const captionTurno = `🎮 *GATO · TRES EN RAYA*\n\n👤 Turno de: ${tag(partidaActiva.turno)} (${siguienteSimbolo})\n💡 _Juega con_ \`${prefijoUsado}gato <1-9>\``;
            return enviarTablero(sock, chatId, msg, t, captionTurno, [partidaActiva.turno]);
        }

        // --- INICIAR NUEVO RETO ---
        if (["gato", "ttt", "tresenraya"].includes(cmdLimpio)) {
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            let objetivoId = ctx?.mentionedJid?.[0] || ctx?.participant;
            let porNumero = false;

            if (!objetivoId && args[0]) {
                const posibleNum = args[0].replace(/[^0-9]/g, "");
                if (posibleNum.length >= 7) {
                    objetivoId = posibleNum + "@s.whatsapp.net";
                    porNumero = true;
                }
            }

            if (!objetivoId) {
                return sock.sendMessage(chatId, { text: `⚠️ Menciona a alguien para retarlo:\n\`${prefijoUsado}gato @usuario [apuesta]\`` }, { quoted: msg });
            }

            if (objetivoId === senderJid) {
                return sock.sendMessage(chatId, { text: "❌ No puedes retarte a ti mismo. 😅" }, { quoted: msg });
            }

            if (partidaActiva) {
                return sock.sendMessage(chatId, { text: "⚠️ Ya tienes una partida o reto pendiente en este grupo." }, { quoted: msg });
            }
            const rivalOcupado = Object.values(global.partidasGato).find(p => p.chatId === chatId && (p.jugadorX === objetivoId || p.jugadorO === objetivoId));
            if (rivalOcupado) {
                return sock.sendMessage(chatId, { text: "⚠️ Ese usuario ya está en otra partida o reto." }, { quoted: msg });
            }

            const candidato = String(porNumero ? args[1] : args[args.length - 1] ?? "");
            let apuesta = /^\d+$/.test(candidato) ? parseInt(candidato) : 0;
            if (isNaN(apuesta) || apuesta < 0) apuesta = 0;

            if (apuesta > 0 && (uGrupoSender.cartera || 0) < apuesta) {
                return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera (${formatoMoneda(apuesta)}).` }, { quoted: msg });
            }

            db.grupos[chatId].usuarios[objetivoId] = db.grupos[chatId].usuarios[objetivoId] || { cartera: 0, banco: 0 };
            const uRival = db.grupos[chatId].usuarios[objetivoId];

            if (apuesta > 0 && (uRival.cartera || 0) < apuesta) {
                return sock.sendMessage(chatId, { text: "❌ El rival no tiene suficiente dinero para igualar la apuesta." }, { quoted: msg });
            }

            const partidaId = chatId + "_" + Date.now();
            global.partidasGato[partidaId] = {
                id: partidaId, chatId,
                jugadorX: senderJid, jugadorO: objetivoId,
                apuesta, estado: "esperando_aceptacion",
                turno: senderJid,
                tablero: [
                    ["⬜", "⬜", "⬜"],
                    ["⬜", "⬜", "⬜"],
                    ["⬜", "⬜", "⬜"]
                ]
            };

            let txtReto = `⚔️ *DUELO DE TRES EN RAYA*\n\n👤 Retador: ${tag(senderJid)}\n🎯 Rival: ${tag(objetivoId)}\n`;
            if (apuesta > 0) txtReto += `💰 Apuesta: ${formatoMoneda(apuesta)}\n`;
            txtReto += `\n> El rival debe responder con \`${prefijoUsado}aceptar\` o \`${prefijoUsado}rechazar\`.`;

            return sock.sendMessage(chatId, { text: txtReto, mentions: [senderJid, objetivoId] }, { quoted: msg });
        }

        // --- .aceptar ---
        if (cmdLimpio === "aceptar") {
            const pendiente = Object.values(global.partidasGato).find(p => p.chatId === chatId && p.jugadorO === senderJid && p.estado === "esperando_aceptacion");
            if (!pendiente) {
                return sock.sendMessage(chatId, { text: "❌ No tienes invitaciones pendientes." }, { quoted: msg });
            }

            pendiente.estado = "jugando";
            const caption = `🎮 *GATO · TRES EN RAYA*\n\n👤 Turno de: ${tag(pendiente.turno)} (❌)\n💡 _Juega con_ \`${prefijoUsado}gato <1-9>\``;
            return enviarTablero(sock, chatId, msg, pendiente.tablero, caption, [pendiente.turno]);
        }

        // --- .rechazar ---
        if (cmdLimpio === "rechazar") {
            const pendiente = Object.values(global.partidasGato).find(p => p.chatId === chatId && p.jugadorO === senderJid && p.estado === "esperando_aceptacion");
            if (!pendiente) {
                return sock.sendMessage(chatId, { text: "❌ No tienes invitaciones pendientes por rechazar." }, { quoted: msg });
            }

            delete global.partidasGato[pendiente.id];
            return sock.sendMessage(chatId, { text: "❌ Has rechazado el reto." }, { quoted: msg });
        }
    }
};
