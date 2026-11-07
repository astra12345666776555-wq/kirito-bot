import fs from "fs";

export default {
    name: "topracha",
    description: "Ranking local por grupo de rachas en trivias, rachas y precisión",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "topracha") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El ranking de rachas solo se puede consultar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };

        let usuariosDelGrupo = db.grupos[chatId].usuarios || {};

        let ranking = Object.entries(usuariosDelGrupo)
            .map(([id, u]) => ({ 
                id, 
                racha: u.rachaTrivia || 0, 
                aciertos: u.aciertosTrivia || 0, 
                total: u.totalTrivia || 1 
            }))
            .sort((a, b) => b.racha - a.racha)
            .slice(0, 10);

        let txt = `╭━━━ 🏆 ❮ TOP RACHAS (LOCAL) ❯ 🧠 ━━━╮\n`;
        txt += `┃\n`;

        if (ranking.length === 0 || ranking.every(r => r.racha === 0)) {
            txt += `┃ 📭 Aún no hay rachas registradas en este grupo.\n`;
            txt += `┃ ¡Juega trivia para dominar el top!\n`;
        } else {
            ranking.forEach((item, index) => {
                let porcentaje = item.total > 0 ? Math.round((item.aciertos / item.total) * 100) : 0;
                let medalla = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🎖️";
                let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(item.id) : "@" + item.id.split("@")[0];

                txt += `┃ ${medalla} *${index + 1}.* ${tagUser}\n`;
                txt += `┃    🔥 Racha: *${item.racha}* ➔ 🎯 Precisión: *${porcentaje}%*\n`;
            });
        }

        txt += `┃\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        let mentionsList = ranking.map(r => r.id);
        return sock.sendMessage(chatId, { text: txt, mentions: mentionsList }, { quoted: msg });
    }
};
