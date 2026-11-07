import fs from "fs";

export default {
    name: "slot",
    description: "Juego de Tragamonedas (Slot) local por grupo con apuestas en cartera, premios de Jackpot y conteo para misiones",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["slot", "tragamonedas"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El tragamonedas (slot) solo se puede jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        // 1. Verificar horario de trabajo en la base local
        const ahora = Date.now();
        if (uGrupo.trabajoActivoHasta && uGrupo.trabajoActivoHasta > ahora) {
            let jefe = uGrupo.jefeTrabajo || "tu jefe";
            return sock.sendMessage(chatId, { text: `❌ *¡ESTÁS EN HORARIO DE TRABAJO!* 👔\nTu jefe *${jefe}* te descubrió intentando usar el slot. ¡Ponte a trabajar!` }, { quoted: msg });
        }

        let apuesta = parseInt(args[0]);
        if (isNaN(apuesta) || apuesta <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Debes indicar una cantidad válida para apostar.\nEjemplo: \`${prefijoUsado}slot 1000\`` }, { quoted: msg });
        }

        if ((uGrupo.cartera || 0) < apuesta) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera local de este grupo (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)}).` }, { quoted: msg });
        }

        const simbolos = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", " 7️⃣ "];
        let s1 = simbolos[Math.floor(Math.random() * simbolos.length)];
        let s2 = simbolos[Math.floor(Math.random() * simbolos.length)];
        let s3 = simbolos[Math.floor(Math.random() * simbolos.length)];

        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        let resultadoTxt = `╭━━━ 🎰 ❮ TRAGAMONEDAS (LOCAL) ❯ 🎰 ━━━╮\n`;
        resultadoTxt += `┃\n`;
        resultadoTxt += `┃ 👤 *Jugador:* ${tagUser}\n`;
        resultadoTxt += `┃\n`;
        resultadoTxt += `┃       ╔═════════════╗\n`;
        resultadoTxt += `┃       ║ ${s1} │ ${s2} │ ${s3} ║\n`;
        resultadoTxt += `┃       ╚═════════════╝\n`;
        resultadoTxt += `┃\n`;

        if (s1 === s2 && s2 === s3) {
            let premio = apuesta * 5;
            uGrupo.cartera += (premio - apuesta); // Gana el neto del premio
            resultadoTxt += `┃ 🎉 *¡JACKPOT SUPREMO!* Ganaste *${formatoMoneda(premio)}* (x5)!\n`;
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            let premio = Math.floor(apuesta * 1.5);
            uGrupo.cartera += (premio - apuesta);
            resultadoTxt += `┃ ✨ *¡Cerca!* Dos símbolos iguales. Ganaste *${formatoMoneda(premio)}*.\n`;
        } else {
            uGrupo.cartera -= apuesta;
            resultadoTxt += `┃ ❌ Perdiste tu apuesta de *${formatoMoneda(apuesta)}*. ¡Suerte la próxima!\n`;
        }

        // 📋 Registrar avance en las Misiones Diarias del grupo
        if (!uGrupo.misionesDiarias) {
            uGrupo.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, slotJugados: 0, reclamado: false };
        }
        if (uGrupo.misionesDiarias.slotJugados === undefined) {
            uGrupo.misionesDiarias.slotJugados = 0;
        }
        uGrupo.misionesDiarias.slotJugados++;

        resultadoTxt += `┃\n`;
        resultadoTxt += `> 📋 _Progreso de misión actualizado (+1 tirada de slot)_\n`;
        resultadoTxt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        if (typeof guardarDB === "function") guardarDB();

        return sock.sendMessage(chatId, { text: resultadoTxt, mentions: [senderJid] }, { quoted: msg });
    }
};
