export default {
    name: "diario",
    description: "Recompensa diaria de Cols (corregido: usa el perfil local del grupo; .claim ahora es del gacha)",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["diario", "daily"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El comando diario debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        // Perfil local del grupo (antes se usaba "usuarioActual", que es un texto y no un objeto)
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios) db.grupos[chatId].usuarios = {};
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0 };
        }
        let uData = db.grupos[chatId].usuarios[senderJid];

        let ahora = Date.now();
        let cooldown = 24 * 60 * 60 * 1000; // 24 horas

        if (uData.ultimoDiario && (ahora - uData.ultimoDiario < cooldown)) {
            let restanteMs = cooldown - (ahora - uData.ultimoDiario);
            let horas = Math.floor(restanteMs / 3600000);
            let minutos = Math.ceil((restanteMs % 3600000) / 60000);
            return sock.sendMessage(chatId, { text: `⏳ Ya reclamaste tu recompensa diaria. Vuelve en *${horas}h ${minutos}m*.` }, { quoted: msg });
        }

        let premio = 5000;
        uData.cartera = (uData.cartera || 0) + premio;
        uData.ultimoDiario = ahora;
        if (typeof guardarDB === 'function') guardarDB();

        let nombreUsuario = db.usuarios?.[senderJid]?.nombreCustom || db.usuarios?.[senderJid]?.alias || `~${senderJid.split('@')[0]}`;

        let txtDiario = `「✿」Recompensa Diaria Reclamada:\n\n`;
        txtDiario += `✰ 1 » *Beneficiario:* ${nombreUsuario}\n`;
        txtDiario += `✰ 2 » *Recompensa:* *${formatoMoneda(premio)}*\n\n`;
        txtDiario += `> • ¡Vuelve mañana para seguir acumulando riquezas!`;

        return sock.sendMessage(chatId, { text: txtDiario }, { quoted: msg });
    }
};
