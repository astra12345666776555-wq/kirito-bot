import fs from "fs";

export default {
    name: "lluvia",
    description: "Inicia una lluvia de dinero financiada desde la cartera local para que los miembros la reclamen con .agarrar",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "lluvia") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Las lluvias de dinero solo se pueden lanzar dentro de los grupos.' }, { quoted: msg });
        }

        let montoLluvia = parseInt(args[0]);
        if (isNaN(montoLluvia) || montoLluvia <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}lluvia <monto>\`\nEjemplo: \`${prefijoUsado}lluvia 3000\`` }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        if ((uGrupo.cartera || 0) < montoLluvia) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficientes Cols en tu cartera local de este grupo para lanzar esta lluvia (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)}).` }, { quoted: msg });
        }

        // Se descuenta el dinero de la cartera local del usuario
        uGrupo.cartera -= montoLluvia;
        if (typeof guardarDB === "function") guardarDB();

        if (!global.lluviaActiva) global.lluviaActiva = {};
        global.lluviaActiva[chatId] = {
            montoRestante: montoLluvia,
            reclamados: []
        };

        let tagSender = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        let txt = `╭━━━ 🌧️ ❮ LLUVIA DE COLS (LOCAL) ❯ 🌧️ ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👤 *Lanzada por:* ${tagSender}\n`;
        txt += `┃ 💰 *Pozo en el cielo:* ${formatoMoneda(montoLluvia)}\n`;
        txt += `┃\n`;
        txt += `> 🏃 ¡Escribe \`${prefijoUsado}agarrar\` rápidamente para reclamar tu parte!\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
    }
};
