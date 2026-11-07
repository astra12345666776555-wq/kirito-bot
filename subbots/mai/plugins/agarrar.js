import fs from "fs";

export default {
    name: "agarrar",
    description: "Permite reclamar recompensas de cofres y lluvias de dinero aleatorias locales en el grupo",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "agarrar") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Las recompensas de cofres y lluvias solo se pueden agarrar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        let cofre = global.cofresActivos && global.cofresActivos[chatId];
        let lluvia = global.lluviaActiva && global.lluviaActiva[chatId];

        if ((!cofre || !cofre.activo) && !lluvia) {
            return sock.sendMessage(chatId, { text: "❌ No hay ningún cofre ni lluvia activa en este grupo en este momento." }, { quoted: msg });
        }

        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        // --- GESTIÓN DE COFRES ---
        if (cofre && cofre.activo) {
            if (cofre.reclamados.includes(senderId)) {
                return sock.sendMessage(chatId, { text: "⚠️ Ya has reclamado este cofre en este grupo, no seas goloso. 😂" }, { quoted: msg });
            }
            if (cofre.reclamados.length >= cofre.ganadoresMax || cofre.montoRestante <= 0) {
                return sock.sendMessage(chatId, { text: "❌ ¡Llegaste tarde! Los cupos de este cofre ya se agotaron." }, { quoted: msg });
            }

            let premioIndividual = Math.floor(cofre.montoTotal / cofre.ganadoresMax);
            cofre.reclamados.push(senderId);
            cofre.montoRestante -= premioIndividual;

            uGrupo.cartera = (uGrupo.cartera || 0) + premioIndividual;
            if (typeof guardarDB === "function") guardarDB();

            let txtCofre = `╭━━━ 🪙 ❮ COFRE RECLAMADO ❯ 🪙 ━━━╮\n`;
            txtCofre += `┃\n`;
            txtCofre += `┃ 🎉 *${tagUser}* abrió el cofre y agarró *${formatoMoneda(premioIndividual)}* para su cartera local.\n`;
            txtCofre += `┃\n`;
            txtCofre += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtCofre, mentions: [senderJid] }, { quoted: msg });
        }

        // --- GESTIÓN DE LLUVIAS (DINERO ALEATORIO) ---
        if (lluvia) {
            if (lluvia.reclamados.includes(senderId)) {
                return sock.sendMessage(chatId, { text: "⚠️ Ya agarraste tu parte de esta lluvia en este grupo." }, { quoted: msg });
            }
            if (lluvia.montoRestante <= 0) {
                return sock.sendMessage(chatId, { text: "❌ ¡La lluvia en este grupo ya se terminó de agotar!" }, { quoted: msg });
            }

            // Premio aleatorio único por usuario entre 100 y 400 Cols
            let premioLluvia = Math.floor(Math.random() * 301) + 100;
            if (premioLluvia > lluvia.montoRestante) premioLluvia = lluvia.montoRestante;

            lluvia.reclamados.push(senderId);
            lluvia.montoRestante -= premioLluvia;

            uGrupo.cartera = (uGrupo.cartera || 0) + premioLluvia;
            if (typeof guardarDB === "function") guardarDB();

            let txtLluvia = `╭━━━ 🌧️ ❮ LLUVIA ATRAPADA ❯ 🌧️ ━━━╮\n`;
            txtLluvia += `┃\n`;
            txtLluvia += `┃ ☔ *${tagUser}* estiró las manos y atrapó al vuelo *${formatoMoneda(premioLluvia)}* de la lluvia local.\n`;
            txtLluvia += `┃\n`;
            txtLluvia += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtLluvia, mentions: [senderJid] }, { quoted: msg });
        }
    }
};
