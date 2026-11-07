import fs from "fs";

export default {
    name: "dado",
    description: "Juego de dados local por grupo donde apuestas y aciertas el número exacto (x5)",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["dado", "dice"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El juego de dados solo se puede jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        let numeroElegido = parseInt(args[0]);
        let apuesta = parseInt(args[1]);

        if (isNaN(numeroElegido) || numeroElegido < 1 || numeroElegido > 6 || isNaN(apuesta) || apuesta <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}dado [número del 1 al 6] [monto]\`\nEjemplo: \`${prefijoUsado}dado 4 1500\`` }, { quoted: msg });
        }

        if ((uGrupo.cartera || 0) < apuesta) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera local de este grupo (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)}).` }, { quoted: msg });
        }

        let tirada = Math.floor(Math.random() * 6) + 1;
        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        let txt = `╭━━━ 🎲 ❮ JUEGO DE DADOS (LOCAL) ❯ 🎲 ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👤 *Jugador:* ${tagUser}\n`;
        txt += `┃ 🎯 *Número elegido:* ${numeroElegido}\n`;
        txt += `┃ 🎲 *El dado cayó en:* *${tirada}*\n`;
        txt += `┃\n`;

        if (numeroElegido === tirada) {
            let premio = apuesta * 5;
            uGrupo.cartera += (premio - apuesta); // Gana netamente 4 veces la apuesta + recupera la suya
            txt += `┃ 🎉 *¡Impresionante!* Acertaste el número exacto y ganaste *${formatoMoneda(premio)}* (x5).\n`;
        } else {
            uGrupo.cartera -= apuesta;
            txt += `┃ ❌ No adivinaste. Perdiste *${formatoMoneda(apuesta)}* de tu cartera local.\n`;
        }

        txt += `┃\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        if (typeof guardarDB === "function") guardarDB();

        return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
    }
};
