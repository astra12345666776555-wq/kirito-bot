// Base de datos temporal global para los usuarios silenciados en los chats
global.mutados = global.mutados || {};

export default {
    name: "mute",
    description: "Silencia a un usuario por un tiempo determinado (borra sus mensajes y bloquea sus comandos).",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        
        if (cmdLimpio === "mute" || cmdLimpio === "silenciar") {
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
                    return await sock.sendMessage(chatId, { text: "❌ Solo los administradores o el dueño pueden silenciar usuarios." }, { quoted: msg });
                }

                // 2. Obtener el usuario objetivo
                let targetJid = null;
                let quotedInfo = msg.message?.extendedTextMessage?.contextInfo;

                if (quotedInfo && quotedInfo.participant) {
                    targetJid = quotedInfo.participant;
                } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                    targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                } else if (args[0] && !isNaN(args[0])) {
                    // Si el primer argumento es un número, podría ser el tiempo y el segundo el usuario, o viceversa.
                    // Manejo estándar: .mute @usuario 5 o .mute 5 (respondiendo)
                }

                // Buscar usuario en menciones o respuestas
                if (!targetJid && args[0]) {
                    let limpioArg = args[0].replace(/[@+\s]/g, "");
                    if (limpioArg.length > 5) targetJid = limpioArg + "@s.whatsapp.net";
                }

                if (!targetJid) {
                    return await sock.sendMessage(chatId, { text: `⚠️ *Uso correcto*:\n• Responde al usuario con \`${prefijoUsado}mute [minutos]\`\n• O menciona: \`${prefijoUsado}mute @usuario [minutos]\`` }, { quoted: msg });
                }

                // 3. Obtener el tiempo en minutos (por defecto 10 minutos si no se especifica)
                let tiempoMinutos = 10;
                let argTiempo = args.find(a => !a.includes("@") && !isNaN(a));
                if (argTiempo) {
                    tiempoMinutos = parseInt(argTiempo);
                }

                let tiempoExpiracion = Date.now() + (tiempoMinutos * 60 * 1000);

                // Inicializar estructura de mute por grupo/chat
                if (!global.mutados[chatId]) global.mutados[chatId] = {};
                global.mutados[chatId][targetJid] = tiempoExpiracion;

                await sock.sendMessage(chatId, { 
                    text: `🔇 *¡Usuario Silenciado!* \n\n• Usuario: @${targetJid.split('@')[0]}\n• Duración: *${tiempoMinutos} minutos*\n• Sus mensajes serán borrados y sus comandos ignorados.`,
                    mentions: [targetJid]
                }, { quoted: msg });

            } catch (e) {
                console.error("Error en comando mute:", e);
            }
        }

        if (cmdLimpio === "unmute" || cmdLimpio === "desmutear") {
            try {
                let ownerJid = CONFIG.OWNER_NUMBER + "@s.whatsapp.net";
                let esDueño = senderJid === ownerJid;
                let esAdminGrupo = false;

                let groupMetadata = chatId.endsWith("@g.us") ? await sock.groupMetadata(chatId).catch(() => null) : null;
                if (groupMetadata) {
                    let participants = groupMetadata.participants || [];
                    let userAdminCheck = participants.find(p => p.id === senderJid)?.admin;
                    if (userAdminCheck) esAdminGrupo = true;
                }

                if (!esDueño && !esAdminGrupo) return;

                let targetJid = null;
                let quotedInfo = msg.message?.extendedTextMessage?.contextInfo;
                if (quotedInfo && quotedInfo.participant) {
                    targetJid = quotedInfo.participant;
                } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                    targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }

                if (targetJid && global.mutados[chatId] && global.mutados[chatId][targetJid]) {
                    delete global.mutados[chatId][targetJid];
                    await sock.sendMessage(chatId, { 
                        text: `🔊 *¡Usuario Desmutear!* @${targetJid.split('@')[0]} ya puede hablar y usar comandos de nuevo.`,
                        mentions: [targetJid]
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: "⚠️ Ese usuario no se encontraba silenciado en este chat." }, { quoted: msg });
                }
            } catch (e) {
                console.error("Error en unmute:", e);
            }
        }
    }
};
