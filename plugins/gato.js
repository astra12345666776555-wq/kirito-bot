import fs from "fs";

export default {
    name: "gato",
    description: "Juego de Tres en Raya (Gato) local por grupo con apuestas en cartera local y retos PvP",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        if (["gato", "ttt", "tresenraya", "aceptar", "rechazar"].includes(cmdLimpio)) {
            // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
            if (!chatId.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '⚠️ El Tres en Raya (Gato) solo se puede jugar dentro de los grupos.' }, { quoted: msg });
            }

            // Inicializar base de datos local del grupo
            if (!db.grupos) db.grupos = {};
            if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
            if (!db.grupos[chatId].usuarios[senderJid]) {
                db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
            }

            let uGrupoSender = db.grupos[chatId].usuarios[senderJid];

            // 1. Verificar horario de trabajo
            const ahora = Date.now();
            if (uGrupoSender.trabajoActivoHasta && uGrupoSender.trabajoActivoHasta > ahora) {
                let jefe = uGrupoSender.jefeTrabajo || "tu jefe";
                return sock.sendMessage(chatId, { text: `❌ *¡ESTÁS EN HORARIO DE TRABAJO!* 👔\nTu jefe *${jefe}* te descubrió intentando jugar al gato en pleno turno.` }, { quoted: msg });
            }

            if (!global.partidasGato) global.partidasGato = {};

            // --- JUGAR CASILLA NUMÉRICA (1-9) ---
            let partidaActiva = Object.values(global.partidasGato).find(p => p.chatId === chatId && (p.jugadorX === senderJid || p.jugadorO === senderJid));
            let argNum = parseInt(args[0]);

            if (!isNaN(argNum) && argNum >= 1 && argNum <= 9 && partidaActiva && partidaActiva.estado === "jugando") {
                if (partidaActiva.turno !== senderJid) {
                    return sock.sendMessage(chatId, { text: "⏳ No es tu turno de jugar en esta partida." }, { quoted: msg });
                }

                let index = argNum - 1;
                let fila = Math.floor(index / 3);
                let col = index % 3;

                if (partidaActiva.tablero[fila][col] !== "⬜") {
                    return sock.sendMessage(chatId, { text: "⚠️ Esa casilla ya está ocupada. Elige otra." }, { quoted: msg });
                }

                let simbolo = partidaActiva.jugadorX === senderJid ? "❌" : "⭕";
                partidaActiva.tablero[fila][col] = simbolo;

                let t = partidaActiva.tablero;
                let ganador = null;

                // Líneas horizontales y verticales
                for (let i = 0; i < 3; i++) {
                    if (t[i][0] !== "⬜" && t[i][0] === t[i][1] && t[i][1] === t[i][2]) ganador = t[i][0];
                    if (t[0][i] !== "⬜" && t[0][i] === t[1][i] && t[1][i] === t[2][i]) ganador = t[0][i];
                }
                // Diagonales
                if (t[0][0] !== "⬜" && t[0][0] === t[1][1] && t[1][1] === t[2][2]) ganador = t[0][0];
                if (t[0][2] !== "⬜" && t[0][2] === t[1][1] && t[1][1] === t[2][0]) ganador = t[0][2];

                let tableroTxt = `╭━━━ 🎮 ❮ TRES EN RAYA (GATO) ❯ 🎮 ━━━╮\n`;
                tableroTxt += `┃\n`;
                tableroTxt += `┃ ${t[0].join(" | ")}\n`;
                tableroTxt += `┃ -----------\n`;
                tableroTxt += `┃ ${t[1].join(" | ")}\n`;
                tableroTxt += `┃ -----------\n`;
                tableroTxt += `┃ ${t[2].join(" | ")}\n`;
                tableroTxt += `┃\n`;

                if (ganador) {
                    partidaActiva.estado = "terminado";
                    let idGanador = ganador === "❌" ? partidaActiva.jugadorX : partidaActiva.jugadorO;
                    let idPerdedor = ganador === "❌" ? partidaActiva.jugadorO : partidaActiva.jugadorX;

                    let uGanadorGrupo = db.grupos[chatId].usuarios[idGanador];
                    let uPerdedorGrupo = db.grupos[chatId].usuarios[idPerdedor];

                    if (partidaActiva.apuesta > 0) {
                        if (uGanadorGrupo) uGanadorGrupo.cartera = (uGanadorGrupo.cartera || 0) + partidaActiva.apuesta;
                        if (uPerdedorGrupo) uPerdedorGrupo.cartera = Math.max(0, (uPerdedorGrupo.cartera || 0) - partidaActiva.apuesta);
                        if (typeof guardarDB === "function") guardarDB();

                        let tagGanador = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(idGanador) : "@" + idGanador.split("@")[0];
                        tableroTxt += `┣━━━ 🎉 ❮ PARTIDA FINALIZADA ❯ ━━━┫\n`;
                        tableroTxt += `┃ 🏆 *Ganador:* ${tagGanador}\n`;
                        tableroTxt += `┃ 🪙 *Premio local:* +${formatoMoneda(partidaActiva.apuesta)}\n`;
                    } else {
                        let tagGanador = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(idGanador) : "@" + idGanador.split("@")[0];
                        tableroTxt += `┣━━━ 🎉 ❮ PARTIDA FINALIZADA ❯ ━━━┫\n`;
                        tableroTxt += `┃ 🏆 *Ganador:* ${tagGanador}\n`;
                    }

                    tableroTxt += `┃\n`;
                    tableroTxt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                    delete global.partidasGato[partidaActiva.id];
                    return sock.sendMessage(chatId, { text: tableroTxt, mentions: [idGanador, idPerdedor] }, { quoted: msg });
                }

                // Verificar empate
                let lleno = t.every(fila => fila.every(celda => celda !== "⬜"));
                if (lleno) {
                    partidaActiva.estado = "terminado";
                    delete global.partidasGato[partidaActiva.id];
                    tableroTxt += `┣━━━ 🤝 ❮ EMPATE ❯ ━━━┫\n`;
                    tableroTxt += `┃ Nadie ganó la partida en este grupo.\n`;
                    tableroTxt += `┃\n`;
                    tableroTxt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                    return sock.sendMessage(chatId, { text: tableroTxt, mentions: [partidaActiva.jugadorX, partidaActiva.jugadorO] }, { quoted: msg });
                }

                // Cambiar turno
                partidaActiva.turno = partidaActiva.turno === partidaActiva.jugadorX ? partidaActiva.jugadorO : partidaActiva.jugadorX;
                let siguienteSimbolo = partidaActiva.turno === partidaActiva.jugadorX ? "❌" : "⭕";
                let tagTurno = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(partidaActiva.turno) : "@" + partidaActiva.turno.split("@")[0];

                tableroTxt += `> 👤 Turno de: ${tagTurno} (${siguienteSimbolo}) — Escribe del *1 al 9*.\n`;
                tableroTxt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                return sock.sendMessage(chatId, { text: tableroTxt, mentions: [partidaActiva.turno] }, { quoted: msg });
            }

            // --- INICIAR NUEVO RETO: .gato @user [apuesta] ---
            if (["gato", "ttt", "tresenraya"].includes(cmdLimpio)) {
                let objetivoId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

                if (!objetivoId || objetivoId.includes("undefined") || objetivoId.length < 10) {
                    return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}${comando} @usuario [apuesta opcional]\`\nEjemplo: \`${prefijoUsado}gato @usuario 500\`` }, { quoted: msg });
                }

                if (objetivoId === senderJid) {
                    return sock.sendMessage(chatId, { text: "❌ No puedes retarte a ti mismo, busca un rival digno. 😅" }, { quoted: msg });
                }

                let apuesta = parseInt(args[args.length - 1]);
                if (isNaN(apuesta) || apuesta < 0) apuesta = 0;

                if (apuesta > 0 && (uGrupoSender.cartera || 0) < apuesta) {
                    return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera local para cubrir esa apuesta (${formatoMoneda(apuesta)}).` }, { quoted: msg });
                }

                // Inicializar rival en el grupo si no existe
                if (!db.grupos[chatId].usuarios[objetivoId]) {
                    db.grupos[chatId].usuarios[objetivoId] = { cartera: 0, banco: 0 };
                }
                let uRivalGrupo = db.grupos[chatId].usuarios[objetivoId];

                if (apuesta > 0 && (uRivalGrupo.cartera || 0) < apuesta) {
                    return sock.sendMessage(chatId, { text: `❌ El usuario retado no tiene suficiente dinero en su cartera local para igualar la apuesta.` }, { quoted: msg });
                }

                let partidaId = chatId + "_" + Date.now();
                global.partidasGato[partidaId] = {
                    id: partidaId,
                    chatId: chatId,
                    jugadorX: senderJid,
                    jugadorO: objetivoId,
                    apuesta: apuesta,
                    estado: "esperando_aceptacion",
                    turno: senderJid,
                    tablero: [
                        ["⬜", "⬜", "⬜"],
                        ["⬜", "⬜", "⬜"],
                        ["⬜", "⬜", "⬜"]
                    ]
                };

                let tagSender = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];
                let tagObjetivo = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(objetivoId) : "@" + objetivoId.split("@")[0];

                let txtReto = `╭━━━ ⚔️ ❮ DUELO DE TRES EN RAYA ❯ ⚔️ ━━━╮\n`;
                txtReto += `┃\n`;
                txtReto += `┃ 👤 *Retador:* ${tagSender}\n`;
                txtReto += `┃ 🎯 *Rival:* ${tagObjetivo}\n`;
                if (apuesta > 0) txtReto += `┃ 💰 *Apuesta local:* ${formatoMoneda(apuesta)}\n`;
                txtReto += `┃\n`;
                txtReto += `> 💬 El rival debe responder con \`${prefijoUsado}aceptar\` o \`${prefijoUsado}rechazar\`.\n`;
                txtReto += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                return sock.sendMessage(chatId, { text: txtReto, mentions: [senderJid, objetivoId] }, { quoted: msg });
            }

            // --- COMANDO .aceptar ---
            if (cmdLimpio === "aceptar") {
                let partidaPendiente = Object.values(global.partidasGato || {}).find(p => p.chatId === chatId && p.jugadorO === senderJid && p.estado === "esperando_aceptacion");

                if (!partidaPendiente) {
                    return sock.sendMessage(chatId, { text: "❌ No tienes ninguna invitación de juego pendiente en este grupo." }, { quoted: msg });
                }

                partidaPendiente.estado = "jugando";
                let t = partidaPendiente.tablero;
                let tagTurno = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(partidaPendiente.turno) : "@" + partidaPendiente.turno.split("@")[0];

                let tableroTxt = `╭━━━ 🎮 ❮ DUELO INICIADO (GATO) ❯ 🎮 ━━━╮\n`;
                tableroTxt += `┃\n`;
                tableroTxt += `┃ ${t[0].join(" | ")}\n`;
                tableroTxt += `┃ -----------\n`;
                tableroTxt += `┃ ${t[1].join(" | ")}\n`;
                tableroTxt += `┃ -----------\n`;
                tableroTxt += `┃ ${t[2].join(" | ")}\n`;
                tableroTxt += `┃\n`;
                tableroTxt += `> 👤 Turno de: ${tagTurno} (❌) — Escribe del *1 al 9*.\n`;
                tableroTxt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                return sock.sendMessage(chatId, { text: tableroTxt, mentions: [partidaPendiente.turno] }, { quoted: msg });
            }

            // --- COMANDO .rechazar ---
            if (cmdLimpio === "rechazar") {
                let partidaPendiente = Object.values(global.partidasGato || {}).find(p => p.chatId === chatId && p.jugadorO === senderJid && p.estado === "esperando_aceptacion");

                if (!partidaPendiente) {
                    return sock.sendMessage(chatId, { text: "❌ No tienes ninguna invitación pendiente por rechazar en este grupo." }, { quoted: msg });
                }

                delete global.partidasGato[partidaPendiente.id];
                return sock.sendMessage(chatId, { text: "❌ Has rechazado el reto de Tres en Raya." }, { quoted: msg });
            }
        }
    }
};
