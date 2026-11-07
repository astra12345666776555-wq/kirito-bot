export default {
    name: "bal",
    description: "Comando de balance con diseño gótico personalizado y adaptativo",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["bal", "balance", "cartera", "dinero"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!targetJid && quotedJid) targetJid = quotedJid;
        if (!targetJid) targetJid = senderJid;

        if (typeof targetJid === 'string' && targetJid.includes('@lid')) {
            targetJid = targetJid.split('@')[0] + '@s.whatsapp.net';
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[targetJid]) {
            db.grupos[chatId].usuarios[targetJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0, guardianHasta: 0 };
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

        // Buscar si está casado
        if (!db.matrimonios) db.matrimonios = {};
        let parejaJid = null;
        for (const key in db.matrimonios) {
            const mat = db.matrimonios[key];
            if (mat.pareja1 === targetJid) {
                parejaJid = mat.pareja2;
                break;
            } else if (mat.pareja2 === targetJid) {
                parejaJid = mat.pareja1;
                break;
            }
        }

        let cartera = uGrupo.cartera || 0;
        let bancoPersonal = uGrupo.banco || 0;
        let bancoTotal = bancoPersonal;
        let nombrePareja = null;

        if (parejaJid) {
            if (!db.usuarios[parejaJid]) {
                db.global.contadorUsuarios++;
                db.usuarios[parejaJid] = { idUnico: String(db.global.contadorUsuarios).padStart(3, '0') };
                guardarDB();
            }
            let uGlobPareja = db.usuarios[parejaJid];
            let numSecoPareja = parejaJid.replace(/[^0-9]/g, '');
            nombrePareja = uGlobPareja.nombreCustom || uGlobPareja.alias || (uGlobPareja.idUnico ? `User${uGlobPareja.idUnico}` : numSecoPareja);

            if (db.grupos[chatId].usuarios[parejaJid]) {
                let bancoPareja = db.grupos[chatId].usuarios[parejaJid].banco || 0;
                bancoTotal = bancoPersonal + bancoPareja;
            }
        }

        let total = cartera + bancoTotal;
        let nivel = uGrupo.nivel || 1;
        let xp = uGrupo.xp || 0;

        // Guardián
        let tiempoProteccionTexto = "Ninguna";
        let ahora = Date.now();
        if (uGrupo.guardianHasta && uGrupo.guardianHasta > ahora) {
            let tiempoRestanteMs = uGrupo.guardianHasta - ahora;
            let horasRestantes = Math.floor(tiempoRestanteMs / (1000 * 60 * 60));
            let minutosRestantes = Math.floor((tiempoRestanteMs % (1000 * 60 * 60)) / (1000 * 60));
            tiempoProteccionTexto = `${horasRestantes}h ${minutosRestantes}m restantes`;
        }

        // Misiones
        let misionesCompletadasTotal = true;
        if (uGrupo.misiones) {
            for (const mKey in uGrupo.misiones) {
                if (!uGrupo.misiones[mKey].completado) {
                    misionesCompletadasTotal = false;
                    break;
                }
            }
        } else {
            misionesCompletadasTotal = false;
        }

        let estadoMisionTxt = misionesCompletadasTotal ? "➪ *¡Misión Completada!* 🜲" : "Pendientes";

        // Estructura gótica personalizada con tu decoración exacta
        let txtBal = `✦ ─── ᴇᴄᴏɴᴏᴍíᴀ ─── ✦\n`;
        txtBal += `➪ ᴜꜱᴜᴀʀɪᴏ » *${nombreMostrar}*\n`;
        txtBal += `──────────────────\n`;
        txtBal += `⛀ ᴄᴀʀᴛᴇʀᴀ » *${formatoMoneda(cartera)}*\n`;
        
        if (parejaJid) {
            txtBal += `⚿ ʙᴀɴᴄᴏ ᴄᴏᴍᴘᴀʀᴛɪᴅᴏ » *${formatoMoneda(bancoTotal)}*\n`;
        } else {
            txtBal += `⚿ ʙᴀɴᴄᴏ » *${formatoMoneda(bancoPersonal)}*\n`;
        }

        txtBal += `⛁ ᴛᴏᴛᴀʟ » *${formatoMoneda(total)}*\n`;
        txtBal += `──────────────────\n`;
        txtBal += `✰ ɴɪᴠᴇʟ » *${nivel}*\n`;
        txtBal += `✰ xᴘ » *${xp}*\n`;
        
        if (parejaJid) {
            txtBal += `ꨄ︎ ᴘᴀʀᴇᴊᴀ » *${nombrePareja}*\n`;
        }

        txtBal += `⛊ ᴘʀᴏᴛᴇᴄᴄɪóɴ » *${tiempoProteccionTexto}*\n`;
        txtBal += `➶ ᴍɪꜱɪÓɴ » ${estadoMisionTxt}\n`;
        txtBal += `──────────────────\n\n`;
        txtBal += `> ⁺˚⋆｡°✩₊ ᴘᴀʀᴀ ᴘʀᴏᴛᴇɢᴇʀ ᴛᴜ ᴅɪɴᴇʀᴏ, ᴅᴇᴘóꜱɪᴛᴀ ᴄᴏɴ \`${prefijoUsado}dep all\`_`;

        return sock.sendMessage(chatId, { text: txtBal }, { quoted: msg });
    }
};
