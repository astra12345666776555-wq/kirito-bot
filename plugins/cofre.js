import fs from "fs";

export default {
    name: "cofre",
    description: "Lanza un cofre de recompensa en el grupo estilo TikTok financiado desde la cartera local",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "cofre") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Los cofres de recompensa solo se pueden lanzar dentro de los grupos.' }, { quoted: msg });
        }

        let monto = parseInt(args[0]);
        let ganadoresMax = parseInt(args[1]) || 5;

        if (isNaN(monto) || monto <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}cofre <monto> <ganadores>\`\nEjemplo: \`${prefijoUsado}cofre 5000 5\`` }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        if ((uGrupo.cartera || 0) < monto) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficientes Cols en tu cartera local de este grupo para fondear este cofre (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)}).` }, { quoted: msg });
        }

        // Descontar saldo del patrocinador en la cartera local del grupo
        uGrupo.cartera -= monto;
        if (typeof guardarDB === "function") guardarDB();

        if (!global.cofresActivos) global.cofresActivos = {};
        global.cofresActivos[chatId] = {
            montoTotal: monto,
            montoRestante: monto,
            ganadoresMax: ganadoresMax,
            reclamados: [],
            activo: true
        };

        let tagPatrocinador = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        let txt = `╭━━━ 🎁 ❮ COFRE ABIERTO (TIKTOK) ❯ 🎁 ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👑 *Patrocinador:* ${tagPatrocinador}\n`;
        txt += `┃ 💰 *Pozo total:* ${formatoMoneda(monto)}\n`;
        txt += `┃ 👥 *Cupos de ganadores:* ${ganadoresMax}\n`;
        txt += `┃ ⏱️ Tienes *20 segundos* para reclamar.\n`;
        txt += `┃\n`;
        txt += `> 🏃 ¡Escribe \`${prefijoUsado}agarrar\` antes de que se vacíe!\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });

        setTimeout(async () => {
            let cofre = global.cofresActivos[chatId];
            if (cofre && cofre.activo) {
                cofre.activo = false;
                await sock.sendMessage(chatId, { text: "🔒 *El cofre se ha cerrado.* ¡Gracias a todos por participar!" });
            }
        }, 20000);
    }
};
