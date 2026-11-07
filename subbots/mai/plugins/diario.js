export default {
    name: "diario",
    description: "Recompensa diaria de Cols con diseño limpio",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["diario", "claim", "daily"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El comando diario debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        let uData = usuarioActual;
        let ahora = Date.now();
        let cooldown = 24 * 60 * 60 * 1000; // 24 horas

        if (uData.ultimoDiario && (ahora - uData.ultimoDiario < cooldown)) {
            let tiempoRestante = Math.ceil((cooldown - (ahora - uData.ultimoDiario)) / (1000 * 60 * 60));
            return sock.sendMessage(chatId, { text: `⏳ Ya reclamaste tu recompensa diaria. Vuelve en *${tiempoRestante} horas*.` }, { quoted: msg });
        }

        let premio = 5000;
        uData.cartera = (uData.cartera || 0) + premio;
        uData.ultimoDiario = ahora;
        if (typeof guardarDB === 'function') guardarDB();

        let nombreUsuario = db.usuarios?.[senderJid]?.alias || `~${senderJid.split('@')[0]}`;

        let txtDiario = `「✿」Recompensa Diaria Reclamada:\n\n`;
        txtDiario += `✰ 1 » *Beneficiario:* ${nombreUsuario}\n`;
        txtDiario += `✰ 2 » *Recompensa:* *${formatoMoneda(premio)}*\n\n`;
        txtDiario += `> • ¡Vuelve mañana para seguir acumulando riquezas!`;

        return sock.sendMessage(chatId, { text: txtDiario }, { quoted: msg });
    }
};
