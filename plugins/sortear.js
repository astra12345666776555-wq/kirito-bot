import fs from "fs";

export default {
    name: "sortear",
    description: "Sistema de sorteos locales por grupo financiados desde la cartera local con distribución aleatoria de premios",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "sortear") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Los sorteos solo se pueden realizar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uSender = db.grupos[chatId].usuarios[senderJid];

        let montoTotal = parseInt(args[0]);
        let cantidadGanadores = parseInt(args[1]) || 1;

        if (isNaN(montoTotal) || montoTotal <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}sortear [monto] [ganadores]\`\nEjemplo: \`${prefijoUsado}sortear 10000 3\`` }, { quoted: msg });
        }

        if ((uSender.cartera || 0) < montoTotal) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficientes Cols en tu cartera local de este grupo para realizar este sorteo (*Tienes:* ${formatoMoneda(uSender.cartera || 0)}).` }, { quoted: msg });
        }

        try {
            let metadata = await sock.groupMetadata(chatId);
            let participantes = metadata.participants.map(p => p.id);

            if (participantes.length < cantidadGanadores) {
                return sock.sendMessage(chatId, { text: "❌ No hay suficientes participantes en el grupo para tantos ganadores." }, { quoted: msg });
            }

            // Descontar del patrocinador en la base local
            uSender.cartera -= montoTotal;

            // Seleccionar ganadores al azar
            let ganadores = participantes.sort(() => 0.5 - Math.random()).slice(0, cantidadGanadores);

            // DISTRIBUCIÓN 100% ALEATORIA (RANDOM EN UN RANDOM)
            let pesos = ganadores.map(() => Math.random() + 0.1);
            let sumaPesos = pesos.reduce((a, b) => a + b, 0);
            let premiosAsignados = pesos.map(p => Math.floor((p / sumaPesos) * montoTotal));

            // Ajustar residuo de redondeo al primer ganador
            let diferencia = montoTotal - premiosAsignados.reduce((a, b) => a + b, 0);
            premiosAsignados[0] += diferencia;

            ganadores.forEach((gId, idx) => {
                if (!db.grupos[chatId].usuarios[gId]) {
                    db.grupos[chatId].usuarios[gId] = { cartera: 0, banco: 0 };
                }
                db.grupos[chatId].usuarios[gId].cartera = (db.grupos[chatId].usuarios[gId].cartera || 0) + premiosAsignados[idx];
            });

            if (typeof guardarDB === "function") guardarDB();

            let tagSender = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

            let txt = `╭━━━ 🎟️ ❮ SORTEO ALEATORIO (LOCAL) ❯ 🎁 ━━━╮\n`;
            txt += `┃\n`;
            txt += `┃ 👤 *Patrocinador:* ${tagSender}\n`;
            txt += `┃ 💰 *Pozo sorteado:* ${formatoMoneda(montoTotal)}\n`;
            txt += `┃\n`;
            txt += `┣━━━ 🏆 *GANADORES:* ━━━\n`;

            ganadores.forEach((gId, idx) => {
                let tagGanador = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(gId) : "@" + gId.split("@")[0];
                txt += `┃ ${idx + 1}. ${tagGanador} ➔ 🪙 *${formatoMoneda(premiosAsignados[idx])}*\n`;
            });

            txt += `┃\n`;
            txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            let mentionsList = [senderId, ...ganadores];
            return sock.sendMessage(chatId, { text: txt, mentions: mentionsList }, { quoted: msg });

        } catch (e) {
            return sock.sendMessage(chatId, { text: "❌ Ocurrió un error al procesar el sorteo en este grupo." }, { quoted: msg });
        }
    }
};
