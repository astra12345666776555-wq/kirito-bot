export default {
    name: "baltop",
    description: "Top local del grupo con cálculo justo de banco compartido para casados y estética gótica",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["top", "baltop"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        if (!db.usuarios) db.usuarios = {};
        if (!db.matrimonios) db.matrimonios = {};

        // Mapear qué cónyuge está casado con quién para consultar rápido
        let casadosMap = {};
        let bancosMatrimonio = {};
        for (const key in db.matrimonios) {
            const mat = db.matrimonios[key];
            let p1 = mat.pareja1;
            let p2 = mat.pareja2;
            casadosMap[p1] = p2;
            casadosMap[p2] = p1;
            
            // Si el grupo maneja banco conjunto o sumamos el banco de ambos del grupo actual
            // Para asegurar el 50/50 exacto del banco en este grupo:
        }

        let listaUsuarios = [];
        const gUsrs = db.grupos?.[chatId]?.usuarios || {};

        for (const uJid in gUsrs) {
            let dataU = gUsrs[uJid];
            let cartera = dataU.cartera || 0;
            let bancoPropio = dataU.banco || 0;
            let bancoFinal = bancoPropio;

            // Si está casado, calculamos el banco compartido de forma justa (50/50 solo para el top)
            let parejaJid = casadosMap[uJid];
            if (parejaJid && gUsrs[parejaJid]) {
                let bancoPareja = gUsrs[parejaJid].banco || 0;
                let bancoTotalMatrimonio = bancoPropio + bancoPareja;
                bancoFinal = Math.floor(bancoTotalMatrimonio / 2);
            }

            let dineroU = cartera + bancoFinal;
            listaUsuarios.push({ jid: uJid, total: dineroU });
        }

        listaUsuarios.sort((a, b) => b.total - a.total);
        let top10 = listaUsuarios.slice(0, 10);

        let txtTop = `「✿」 *ʟᴏꜱ ᴜꜱᴜᴀʀɪᴏꜱ ᴄᴏɴ mÁꜱ ᴅɪɴᴇʀᴏ ᴇɴ ᴇʟ ɢʀᴜᴘᴏ*:\n\n`;

        if (top10.length === 0) {
            txtTop += `> _Aún no hay registros económicos._`;
        } else {
            let pos = 1;
            for (const item of top10) {
                let uGlob = db.usuarios[item.jid] || {};
                let numSeco = item.jid.replace(/[^0-9]/g, '');
                let nombreItem = uGlob.nombreCustom || uGlob.alias || (uGlob.idUnico ? `User${uGlob.idUnico}` : numSeco);

                txtTop += `✰ ${pos} » *${nombreItem}*\n`;
                txtTop += `\t\t ᴛᴏᴛᴀʟ » *${formatoMoneda(item.total)}*\n`;
                pos++;
            }
        }

        txtTop += `\n> • ᴘáɢɪɴᴀ *1* ᴅᴇ *1*`;
        return sock.sendMessage(chatId, { text: txtTop }, { quoted: msg });
    }
};
