export default {
    name: "kick",
    description: "Expulsa a un usuario del grupo mencionándolo o respondiendo a su mensaje.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["kick", "ban", "expulsar"].includes(cmdLimpio)) return;

        try {
            // 1. Validar permisos (Dueño o Administrador)
            let ownerJid = CONFIG.OWNER_NUMBER + "@s.whatsapp.net";
            let esDueño = senderJid === ownerJid;
            let esAdminGrupo = false;

            let groupMetadata = chatId.endsWith("@g.us") ? await sock.groupMetadata(chatId).catch(() => null) : null;
            if (groupMetadata) {
                let participants = groupMetadata.participants || [];
                let userAdminCheck = participants.find(p => p.id === senderJid)?.admin;
                if (userAdminCheck) esAdminGrupo = true;
            }

            if (!esDueño && !esAdminGrupo) {
                return await sock.sendMessage(chatId, { text: "❌ Solo los administradores o el dueño pueden usar este comando de expulsión." }, { quoted: msg });
            }

            // 2. Obtener el usuario a expulsar (por mención, respuesta o argumento)
            let targetJid = null;
            let quotedInfo = msg.message?.extendedTextMessage?.contextInfo;

            if (quotedInfo && quotedInfo.participant) {
                targetJid = quotedInfo.participant;
            } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (args[0]) {
                let limpioArg = args[0].replace(/[@+\s]/g, "");
                targetJid = limpioArg + "@s.whatsapp.net";
            }

            if (!targetJid || !targetJid.includes("@s.whatsapp.net")) {
                return await sock.sendMessage(chatId, { text: `⚠️ *Uso correcto*:\n• Responde al mensaje del usuario con \`${prefijoUsado}kick\`\n• O menciona al usuario: \`${prefijoUsado}kick @usuario [motivo]\`` }, { quoted: msg });
            }

            // Evitar que el bot se expulse a sí mismo o al dueño accidentalmente
            let botJid = sock.user.id.split(':')[0] + "@s.whatsapp.net";
            if (targetJid === botJid) {
                return await sock.sendMessage(chatId, { text: "❌ No me puedo expulsar a mí mismo, jefe." }, { quoted: msg });
            }

            // 3. Extraer motivo opcional si lo hay
            let motivo = args.slice(1).join(" ") || "Sin motivo especificado";

            // 4. Ejecutar la expulsión del grupo
            await sock.groupParticipantsUpdate(chatId, [targetJid], "remove");
            
            await sock.sendMessage(chatId, { 
                text: `👢 *¡Usuario Expulsado!* \n\n• Usuario: @${targetJid.split('@')[0]}\n• Motivo: _${motivo}_`,
                mentions: [targetJid]
            }, { quoted: msg });

        } catch (e) {
            console.error("Error en plugin kick/ban:", e);
            await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al intentar expulsar al usuario. Asegúrate de que soy administrador del grupo." }, { quoted: msg });
        }
    }
};
