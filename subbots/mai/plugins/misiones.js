export default {
    name: "misiones",
    description: "Misiones diarias con estética gótica, sin emojis y misiones independientes",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["misiones", "quests", "mission"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        let targetJid = senderJid;
        if (typeof targetJid === 'string' && targetJid.includes('@lid')) {
            targetJid = targetJid.split('@')[0] + '@s.whatsapp.net';
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[targetJid]) {
            db.grupos[chatId].usuarios[targetJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0 };
        }
        let uGrupo = db.grupos[chatId].usuarios[targetJid];

        if (!db.usuarios) db.usuarios = {};
        if (!db.global) db.global = {};
        if (!db.global.contadorUsuarios) db.global.contadorUsuarios = 0;

        if (!db.usuarios[targetJid]) {
            db.global.contadorUsuarios++;
            db.usuarios[targetJid] = { idUnico: String(db.global.contadorUsuarios).padStart(3, '0') };
            guardarDB();
        } else if (!db.usuarios[targetJid].idUnico) {
            db.global.contadorUsuarios++;
            db.usuarios[targetJid].idUnico = String(db.global.contadorUsuarios).padStart(3, '0');
            guardarDB();
        }

        let uGlobal = db.usuarios[targetJid];
        let numeroSeco = targetJid.replace(/[^0-9]/g, '');
        let nombreMostrar = uGlobal.nombreCustom || uGlobal.alias || (uGlobal.idUnico ? `User${uGlobal.idUnico}` : numeroSeco);

        // Inicializar todas las misiones incluyendo la de moneda
        if (!uGrupo.misiones) {
            uGrupo.misiones = {};
        }
        if (!uGrupo.misiones.moneda) {
            uGrupo.misiones.moneda = { progreso: 0, meta: 3, completado: false, recompensa: 6000 };
        }
        if (!uGrupo.misiones.trivia) {
            uGrupo.misiones.trivia = { progreso: 0, meta: 2, completado: false, recompensa: 5000 };
        }
        if (!uGrupo.misiones.ahorcado) {
            uGrupo.misiones.ahorcado = { progreso: 0, meta: 1, completado: false, recompensa: 7000 };
        }

        let mis = uGrupo.misiones;

        let txtMisiones = `「✿」 *ᴍɪꜱɪᴏɴᴇꜱ ᴅɪᴀʀɪᴀꜱ ᴅᴇ ${nombreMostrar}*:\n\n`;

        // Misión 1: Moneda (Ganar 3 veces)
        let mMonedaEstado = mis.moneda.completado ? "ᴄᴏᴍᴘʟᴇᴛᴀᴅᴏ 🜲" : `${mis.moneda.progreso}/${mis.moneda.meta} (ᴘᴇɴᴅɪᴇɴᴛᴇ)`;
        txtMisiones += `✰ 1 » *Maestro del Azar* (Gana 3 veces en \`${prefijoUsado}moneda\`)\n`;
        txtMisiones += `\t\t ᴇꜱᴛᴀᴅᴏ » *${mMonedaEstado}* | ᴘʀᴇᴍɪᴏ » *${formatoMoneda(mis.moneda.recompensa)}*\n\n`;

        // Misión 2: Trivia
        let mTriviaEstado = mis.trivia.completado ? "ᴄᴏᴍᴘʟᴇᴛᴀᴅᴏ 🜲" : `${mis.trivia.progreso}/${mis.trivia.meta} (ᴘᴇɴᴅɪᴇɴᴛᴇ)`;
        txtMisiones += `✰ 2 » *Sabio de la Trivia* (Usa \`${prefijoUsado}trivia\`)\n`;
        txtMisiones += `\t\t ᴇꜱᴛᴀᴅᴏ » *${mTriviaEstado}* | ᴘʀᴇᴍɪᴏ » *${formatoMoneda(mis.trivia.recompensa)}*\n\n`;

        // Misión 3: Ahorcado
        let mAhorcadoEstado = mis.ahorcado.completado ? "ᴄᴏᴍᴘʟᴇᴛᴀᴅᴏ 🜲" : `${mis.ahorcado.progreso}/${mis.ahorcado.meta} (ᴘᴇɴᴅɪᴇɴᴛᴇ)`;
        txtMisiones += `✰ 3 » *Cazador de Palabras* (Usa \`${prefijoUsado}ahorcado\`)\n`;
        txtMisiones += `\t\t ᴇꜱᴛᴀᴅᴏ » *${mAhorcadoEstado}* | ᴘʀᴇᴍɪᴏ » *${formatoMoneda(mis.ahorcado.recompensa)}*\n`;

        txtMisiones += `\n> • ᴄᴏᴍᴘʟᴇᴛᴀ ᴛᴜꜱ ᴍɪꜱɪᴏɴᴇꜱ ᴘᴀʀᴀ ʀᴇᴄʟᴀᴍᴀʀ ʀᴇᴄᴏᴍᴘᴇɴꜱᴀꜱ.`;

        return sock.sendMessage(chatId, { text: txtMisiones }, { quoted: msg });
    }
};
