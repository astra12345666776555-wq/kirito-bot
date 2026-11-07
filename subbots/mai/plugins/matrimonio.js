export default {
    name: "matrimonio",
    description: "Sistema unificado de matrimonio y divorcio con liquidación 50/50 justa de cartera y banco",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["casar", "marry", "aceptarboda", "divorcio"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.matrimonios) db.matrimonios = {};
        if (!global.bodasPendientes) global.bodasPendientes = {};

        if (!db.usuarios) db.usuarios = {};
        if (!db.global) db.global = {};
        if (!db.global.contadorUsuarios) db.global.contadorUsuarios = 0;

        // Función auxiliar para regla de oro (Nombre custom o ID/número seco sin arroba)
        const obtenerNombreLimpio = (jid) => {
            if (!db.usuarios[jid]) {
                db.global.contadorUsuarios++;
                db.usuarios[jid] = { idUnico: String(db.global.contadorUsuarios).padStart(3, '0') };
                guardarDB();
            } else if (!db.usuarios[jid].idUnico) {
                db.global.contadorUsuarios++;
                db.usuarios[jid].idUnico = String(db.global.contadorUsuarios).padStart(3, '0');
                guardarDB();
            }
            let uGlob = db.usuarios[jid];
            let numSeco = jid.replace(/[^0-9]/g, '');
            return uGlob.nombreCustom || uGlob.alias || (uGlob.idUnico ? `User${uGlob.idUnico}` : numSeco);
        };

        let nombreSender = obtenerNombreLimpio(senderJid);

        // -------------------------------------------------------------
        // 1. COMANDO: .casar / .marry
        // -------------------------------------------------------------
        if (["casar", "marry"].includes(cmdLimpio)) {
            let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!targetJid && quotedJid) targetJid = quotedJid;

            if (typeof targetJid === 'string' && targetJid.includes('@lid')) {
                targetJid = targetJid.split('@')[0] + '@s.whatsapp.net';
            }

            if (!targetJid || targetJid === senderJid) {
                return sock.sendMessage(chatId, { text: `⚠️ Debes mencionar o responder al mensaje de la persona con la que deseas casarte.\nEjemplo: \`${prefijoUsado}casar @usuario\`` }, { quoted: msg });
            }

            for (const key in db.matrimonios) {
                const mat = db.matrimonios[key];
                if (mat.pareja1 === senderJid || mat.pareja2 === senderJid) {
                    return sock.sendMessage(chatId, { text: `⚠️ Ya estás casado/a con otra persona.` }, { quoted: msg });
                }
                if (mat.pareja1 === targetJid || mat.pareja2 === targetJid) {
                    return sock.sendMessage(chatId, { text: `⚠️ Esa persona ya se encuentra casada con alguien más.` }, { quoted: msg });
                }
            }

            let nombreTarget = obtenerNombreLimpio(targetJid);

            global.bodasPendientes[targetJid] = { solicitante: senderJid, chatId: chatId };
            guardarDB();

            let txtPropuesta = `╭━━━ 🅲 ❮ ᴘʀᴏᴘᴜᴇꜱᴛᴀ ᴅᴇ ᴍᴀᴛʀɪᴍᴏɴɪᴏ ❯ 🅲 ━━━╮\n`;
            txtPropuesta += `┃\n`;
            txtPropuesta += `┃ ❖ ꜱᴏʟɪᴄɪᴛᴀɴᴛᴇ » *${nombreSender}*\n`;
            txtPropuesta += `┃ ❖ ᴀꜱᴘɪʀᴀɴᴛᴇ » *${nombreTarget}*\n`;
            txtPropuesta += `┃\n`;
            txtPropuesta += `┃ ❀ ᴀᴠɪꜱᴏ » *¡Has recibido una propuesta de matrimonio!* 🜲\n`;
            txtPropuesta += `┃\n`;
            txtPropuesta += `> ❖ ᴇꜱᴛᴀᴅᴏ » _Usa \`${prefijoUsado}aceptarboda\` para aceptar_\n`;
            txtPropuesta += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtPropuesta }, { quoted: msg });
        }

        // -------------------------------------------------------------
        // 2. COMANDO: .aceptarboda
        // -------------------------------------------------------------
        if (cmdLimpio === "aceptarboda") {
            if (!global.bodasPendientes || !global.bodasPendientes[senderJid]) {
                return sock.sendMessage(chatId, { text: `⚠️ No tienes ninguna propuesta de matrimonio pendiente.` }, { quoted: msg });
            }

            let boda = global.bodasPendientes[senderJid];
            let parejaId = boda.solicitante;

            for (const key in db.matrimonios) {
                const mat = db.matrimonios[key];
                if (mat.pareja1 === senderJid || mat.pareja2 === senderJid || mat.pareja1 === parejaId || mat.pareja2 === parejaId) {
                    delete global.bodasPendientes[senderJid];
                    return sock.sendMessage(chatId, { text: `⚠️ Uno de los dos ya está casado con otra persona.` }, { quoted: msg });
                }
            }

            let matrimonioId = `${parejaId}_${senderJid}`;
            db.matrimonios[matrimonioId] = {
                pareja1: parejaId,
                pareja2: senderJid,
                fecha: Date.now()
            };

            delete global.bodasPendientes[senderJid];
            guardarDB();

            let nombrePareja = obtenerNombreLimpio(parejaId);

            let txtBoda = `╭━━━ 🅲 ❮ ᴀʟᴛᴀʀ ᴅᴇ ʙᴏᴅᴀꜱ ɢʟᴏʙᴀʟᴇꜱ ❯ 🅲 ━━━╮\n`;
            txtBoda += `┃\n`;
            txtBoda += `┃ ❖ ᴇꜱᴘᴏꜱᴏ » *${nombrePareja}*\n`;
            txtBoda += `┃ ❖ ᴇꜱᴘᴏꜱᴀ/ᴏ » *${nombreSender}*\n`;
            txtBoda += `┃\n`;
            txtBoda += `┃ ❀ ʀᴇꜱᴜʟᴛᴀᴅᴏ » *¡Vínculo global establecido exitosamente!* 🜲\n`;
            txtBoda += `┃\n`;
            txtBoda += `> ❖ ᴇꜱᴛᴀᴅᴏ » _Sus economías se han unificado de forma justa_\n`;
            txtBoda += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtBoda }, { quoted: msg });
        }

        // -------------------------------------------------------------
        // 3. COMANDO: .divorcio (Liquidación 50/50 justa de cartera y banco)
        // -------------------------------------------------------------
        if (cmdLimpio === "divorcio") {
            let matrimonioClave = null;
            let exParejaId = null;

            for (const key in db.matrimonios) {
                const mat = db.matrimonios[key];
                if (mat.pareja1 === senderJid) {
                    matrimonioClave = key;
                    exParejaId = mat.pareja2;
                    break;
                } else if (mat.pareja2 === senderJid) {
                    matrimonioClave = key;
                    exParejaId = mat.pareja1;
                    break;
                }
            }

            if (!matrimonioClave) {
                return sock.sendMessage(chatId, { text: `⚠️ No estás casado con nadie, ¡estás soltero/a y libre!` }, { quoted: msg });
            }

            if (!db.grupos[chatId].usuarios[senderJid]) {
                db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
            }
            if (!db.grupos[chatId].usuarios[exParejaId]) {
                db.grupos[chatId].usuarios[exParejaId] = { cartera: 0, banco: 0 };
            }

            let uSenderGrupo = db.grupos[chatId].usuarios[senderJid];
            let uExParejaGrupo = db.grupos[chatId].usuarios[exParejaId];

            // Sumar cartera + banco de ambos para hacer una liquidación 50/50 total y blindada contra jugadas sucias
            let totalCartera = (uSenderGrupo.cartera || 0) + (uExParejaGrupo.cartera || 0);
            let totalBanco = (uSenderGrupo.banco || 0) + (uExParejaGrupo.banco || 0);
            
            let mitadCartera = Math.floor(totalCartera / 2);
            let mitadBanco = Math.floor(totalBanco / 2);

            // Asignar el 50/50 exacto a cada uno
            uSenderGrupo.cartera = mitadCartera;
            uExParejaGrupo.cartera = mitadCartera;
            
            uSenderGrupo.banco = mitadBanco;
            uExParejaGrupo.banco = mitadBanco;

            delete db.matrimonios[matrimonioClave];
            guardarDB();

            let nombreEx = obtenerNombreLimpio(exParejaId);

            let txtDivorcio = `╭━━━ 🅲 ❮ ᴛʀÁᴍɪᴛᴇ ᴅᴇ ᴅɪᴠᴏʀᴄɪᴏ (50/50) ❯ 🅲 ━━━╮\n`;
            txtDivorcio += `┃\n`;
            txtDivorcio += `┃ ❖ ꜱᴏʟɪᴄɪᴛᴀɴᴛᴇ » *${nombreSender}*\n`;
            txtDivorcio += `┃ ❖ ᴇx-ᴘᴀʀᴇᴊᴀ » *${nombreEx}*\n`;
            txtDivorcio += `┃\n`;
            txtDivorcio += `┃ ❀ ʀᴇꜱᴜʟᴛᴀᴅᴏ » *Matrimonio anulado y bienes liquidados (50/50)* 🜲\n`;
            txtDivorcio += `┃ 🪙 *Cartera Repartida:* *${formatoMoneda(mitadCartera)}* c/u\n`;
            txtDivorcio += `┃ ⚿ *Banco Repartido:* *${formatoMoneda(mitadBanco)}* c/u\n`;
            txtDivorcio += `┃\n`;
            txtDivorcio += `> ❖ ᴇꜱᴛᴀᴅᴏ » _Adiós al amor, adiós a las jugadas sucias_\n`;
            txtDivorcio += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtDivorcio }, { quoted: msg });
        }
    }
};
