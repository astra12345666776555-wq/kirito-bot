export default {
    name: "reportes",
    description: "Sistema de reportes abiertos para usuarios y visualización de expedientes y advertencias.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        if (!chatId.endsWith('@g.us')) return;

        db.grupos = db.grupos || {};
        db.grupos[chatId] = db.grupos[chatId] || {};
        let gData = db.grupos[chatId];

        // --- COMANDO: .reportar <@usuario | respondiendo> [motivo] ---
        if (["report", "reportar"].includes(cmdLimpio)) {
            let contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            let targetJid = contextInfo?.participant || (args[0] && args[0].includes('@') ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
            let motivo = contextInfo ? args.join(" ") : args.slice(1).join(" ");

            if (!targetJid) {
                return sock.sendMessage(chatId, { text: `⚠️ Uso incorrecto. Debes etiquetar a un usuario o responder a su mensaje para reportarlo.\nEjemplo: \`${prefijoUsado}reportar @usuario Motivo de la falta\`` }, { quoted: msg });
            }

            if (!motivo) motivo = "Sin motivo especificado";

            gData.reportes = gData.reportes || {};
            gData.reportes[targetJid] = gData.reportes[targetJid] || [];
            
            gData.reportes[targetJid].push({
                reportadoPor: senderJid,
                motivo: motivo,
                fecha: Date.now()
            });

            if (typeof guardarDB === "function") guardarDB();

            let totalFaltasReportadas = gData.reportes[targetJid].length;
            let tagReportado = `@${targetJid.split('@')[0]}`;
            let tagReportador = `@${senderJid.split('@')[0]}`;

            let txtReporte = `🚨 *¡NUEVO REPORTE REGISTRADO!* 🚨\n\n` +
                             `• Usuario reportado: ${tagReportado}\n` +
                             `• Reportado por: ${tagReportador}\n` +
                             `• Motivo: *${motivo}*\n` +
                             `• Total de reportes acumulados: *${totalFaltasReportadas}*`;

            return sock.sendMessage(chatId, { text: txtReporte, mentions: [targetJid, senderJid] }, { quoted: msg });
        }

        // --- COMANDO: .expediente o .reportes <@usuario> ---
        if (["expediente", "reportes"].includes(cmdLimpio)) {
            let contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            let targetJid = contextInfo?.participant || (args[0] && args[0].includes('@') ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null) || senderJid;
            let targetNum = targetJid.split('@')[0];

            let advs = gData.advertencias?.[targetJid] || { link: 0, spam: 0, palabrota: 0 };
            let totalAdvs = (advs.link || 0) + (advs.spam || 0) + (advs.palabrota || 0);
            let reportesUser = gData.reportes?.[targetJid] || [];

            let txtExpediente = `╭━━━ 📋 ❮ EXPEDIENTE DEL USUARIO ❯ 📋 ━━━╮\n` +
                                `┃\n` +
                                `┃ 👤 *Usuario:* @${targetNum}\n` +
                                `┃ ⚠️ *Advertencias activas:* *${totalAdvs}*\n` +
                                `┃   - Links prohibidos: ${advs.link}\n` +
                                `┃   - Spam detectado: ${advs.spam}\n` +
                                `┃   - Palabrotas: ${advs.palabrota}\n` +
                                `┃ 🚨 *Reportes manuales:* ${reportesUser.length}\n` +
                                `┃\n`;

            if (reportesUser.length > 0) {
                txtExpediente += `> 📌 *Últimos motivos de reporte:*\n`;
                reportesUser.slice(-3).forEach((rep, idx) => {
                    let fechaStr = new Date(rep.fecha).toLocaleDateString();
                    txtExpediente += `> ${idx + 1}. "${rep.motivo}" (${fechaStr})\n`;
                });
            } else {
                txtExpediente += `> ✨ _El usuario tiene el historial limpio._\n`;
            }
            txtExpediente += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtExpediente, mentions: [targetJid] }, { quoted: msg });
        }

        // --- COMANDO: .delreportes <@usuario> (Limpia reportes y advertencias por completo) ---
        if (cmdLimpio === "delreportes") {
            let ownerNum = String(CONFIG.OWNER_NUMBER || "51947497514").replace(/[^0-9]/g, '');
            let jidStr = typeof senderJid === 'string' ? senderJid : (senderJid?.remoteJid || senderJid?.id || String(senderJid || ""));
            let senderNum = jidStr.replace(/[^0-9]/g, '');
            let esDueño = senderNum === ownerNum || jidStr.includes(ownerNum);

            let esAdmin = esDueño;
            if (!esAdmin) {
                let metadata = await sock.groupMetadata(chatId).catch(() => null);
                let participants = metadata?.participants || [];
                let adminCheck = participants.find(p => p.id === jidStr || p.id.includes(senderNum))?.admin;
                if (adminCheck) esAdmin = true;
            }

            if (!esAdmin) {
                return sock.sendMessage(chatId, { text: "❌ Solo los administradores pueden limpiar expedientes y advertencias." }, { quoted: msg });
            }

            let contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            let targetJid = contextInfo?.participant || (args[0] && args[0].includes('@') ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);

            if (!targetJid) {
                return sock.sendMessage(chatId, { text: `⚠️ Menciona o responde al usuario al que deseas limpiar el expediente (reportes y advertencias).` }, { quoted: msg });
            }

            let borradoAlgo = false;
            if (gData.reportes && gData.reportes[targetJid]) {
                delete gData.reportes[targetJid];
                borradoAlgo = true;
            }
            if (gData.advertencias && gData.advertencias[targetJid]) {
                delete gData.advertencias[targetJid];
                borradoAlgo = true;
            }

            if (typeof guardarDB === "function") guardarDB();

            return sock.sendMessage(chatId, { text: `✅ ¡Expediente blanqueado! Se borraron todos los reportes y advertencias de @${targetJid.split('@')[0]}.`, mentions: [targetJid] }, { quoted: msg });
        }
    }
};
