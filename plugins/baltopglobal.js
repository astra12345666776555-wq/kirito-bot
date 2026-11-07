export default {
    name: "baltopglobal",
    description: "Top global con cálculo justo de banco compartido para casados al 50/50 y estética gótica",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "baltopglobal") return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        if (!db.usuarios) db.usuarios = {};
        if (!db.matrimonios) db.matrimonios = {};

        let casadosMap = {};
        for (const key in db.matrimonios) {
            const mat = db.matrimonios[key];
            casadosMap[mat.pareja1] = mat.pareja2;
            casadosMap[mat.pareja2] = mat.pareja1;
        }

        let acumuladoGlobal = {};

        if (db.grupos) {
            for (const gId in db.grupos) {
                const gUsrs = db.grupos[gId]?.usuarios || {};
                for (const uJid in gUsrs) {
                    let dataU = gUsrs[uJid];
                    let cartera = dataU.cartera || 0;
                    let bancoPropio = dataU.banco || 0;
                    let bancoFinal = bancoPropio;

                    let parejaJid = casadosMap[uJid];
                    if (parejaJid && gUsrs[parejaJid]) {
                        let bancoPareja = gUsrs[parejaJid].banco || 0;
                        let bancoTotalMatrimonio = bancoPropio + bancoPareja;
                        bancoFinal = Math.floor(bancoTotalMatrimonio / 2);
                    }

                    let dineroU = cartera + bancoFinal;
                    acumuladoGlobal[uJid] = (acumuladoGlobal[uJid] || 0) + dineroU;
                }
            }
        }

        let listaUsuarios = [];
        for (const uJid in acumuladoGlobal) {
            listaUsuarios.push({ jid: uJid, total: acumuladoGlobal[uJid] });
        }

        listaUsuarios.sort((a, b) => b.total - a.total);
        let top10 = listaUsuarios.slice(0, 10);

        let txtTop = `「✿」 *ʟᴏꜱ ᴜꜱᴜᴀʀɪᴏꜱ ᴄᴏɴ mÁꜱ ᴅɪɴᴇʀᴏ ɢʟᴏʙᴀʟ*:\n\n`;

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
