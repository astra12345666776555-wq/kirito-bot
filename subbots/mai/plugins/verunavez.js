import { downloadMediaMessage } from '@whiskeysockets/baileys';       
export default {
    name: "verunavez",
    description: "Rescata archivos de ver una vez de forma pública, con soporte en chats privados y modo silencio absoluto.",                                       
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let numeroSender = String(senderJid || usuarioActual || "").replace(/[^0-9]/g, '');
        let ownerNum = String(CONFIG.OWNER_NUMBER || "51947497514").replace(/[^0-9]/g, '');

        if (!db.global) db.global = {};
        db.global.modoVV = db.global.modoVV || {};
        
        // Por defecto el modo es "publico" para que cualquiera pueda usarlo
        let modoActualChat = db.global.modoVV[chatId] || "publico";

        // Bypass absoluto para ti (Dueño)
        let esDueño = numeroSender === ownerNum || 
                      numeroSender === "51947497514" || 
                      numeroSender === "134935692214494" || 
                      numeroSender === "51902138122" || 
                      String(senderJid).includes(ownerNum);

        let cmdLimpio = (comando || "").toLowerCase().trim();
        let subCmd = (args[0] || "").toLowerCase();

        // Configuración de modos (.vv modo publico / .vv modo off)
        if (["ver", "vv", "rescatar", "verunavez"].includes(cmdLimpio) && ["modo", "nivel", "config"].includes(subCmd)) {
            if (!esDueño) {
                let groupMetadata = chatId.endsWith("@g.us") ? await sock.groupMetadata(chatId).catch(() => null) : null;                                   
                let userAdminCheck = groupMetadata?.participants?.find(p => p.id === senderJid)?.admin;
                if (!userAdminCheck) {
                    return sock.sendMessage(chatId, { text: "❌ Solo el dueño o los administradores pueden cambiar el modo de acceso de Ver Una Vez." }, { quoted: msg });                                                        
                }
            }

            let nuevoModo = (args[1] || "").toLowerCase();
            if (["publico", "todos", "libre", "on"].includes(nuevoModo)) {
                db.global.modoVV[chatId] = "publico";
                guardarDB();
                return sock.sendMessage(chatId, { text: "🔓 *Modo VV Configurado*: ¡Ahora **todo el mundo** puede usar los comandos de Ver Una Vez en este chat!" }, { quoted: msg });
            } else if (["off", "desactivado", "apagado", "owner", "dueño", "solo yo"].includes(nuevoModo)) {
                db.global.modoVV[chatId] = "off";
                guardarDB();
                return sock.sendMessage(chatId, { text: "🔇 *Modo VV Configurado*: Comando **desactivado para el público**. Habrá silencio absoluto (solo el Dueño puede usarlo)." }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: `⚙️ *Modo Actual de VV*: \`${modoActualChat}\`\n\n• \`${prefijoUsado}vv modo publico\` -> Abierto para todos\n• \`${prefijoUsado}vv modo off\` -> Silencio absoluto (Solo Dueño)` }, { quoted: msg });
            }
        }

        // Definir si tiene acceso
        let tieneAcceso = false;
        if (esDueño) {
            tieneAcceso = true; // Dueño siempre pasa
        } else if (modoActualChat === "publico") {
            tieneAcceso = true; // Si está público, todos pasan
        } else {
            tieneAcceso = false; // Si está en off, los demás no pasan
        }

        let textoCompleto = (comando || "").trim();
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Detección por emoji estricto (🔥 / 👍)
        const esEmojiEstricto = quotedMsg && /^[🔥👍\s]+$/u.test(textoCompleto) && textoCompleto.length <= 5;
        if (esEmojiEstricto) {
            if (!tieneAcceso) return; // Silencio absoluto: si está apagado para los demás, se ignora sin decir nada

            try {
                let innerMsg = quotedMsg.viewOnceMessage?.message ||
                               quotedMsg.viewOnceMessageV2?.message ||
                               quotedMsg.viewOnceMessageV2Extension?.message ||
                               quotedMsg;

                let mediaType = null;
                let messageWrapper = null;

                if (innerMsg.imageMessage) {
                    mediaType = 'image';
                    messageWrapper = { message: { imageMessage: innerMsg.imageMessage } };
                } else if (innerMsg.videoMessage) {
                    mediaType = 'video';
                    messageWrapper = { message: { videoMessage: innerMsg.videoMessage } };
                } else if (innerMsg.audioMessage) {
                    mediaType = 'audio';
                    messageWrapper = { message: { audioMessage: innerMsg.audioMessage } };
                } else if (quotedMsg.imageMessage) {
                    mediaType = 'image';
                    messageWrapper = { message: { imageMessage: quotedMsg.imageMessage } };
                } else if (quotedMsg.videoMessage) {
                    mediaType = 'video';
                    messageWrapper = { message: { videoMessage: quotedMsg.videoMessage } };
                } else if (quotedMsg.audioMessage) {                                      
                    mediaType = 'audio';                                                  
                    messageWrapper = { message: { audioMessage: quotedMsg.audioMessage } };
                }

                if (!mediaType || !messageWrapper) return;
                                                                                      
                let buffer = await downloadMediaMessage(
                    messageWrapper,
                    'buffer',
                    {},
                    { logger: console }
                );

                // Destino: si es grupo responde en el grupo, si es privado se va al chat actual o número fijo
                let destinoJid = chatId.endsWith("@g.us") ? chatId : chatId;
                await new Promise(resolve => setTimeout(resolve, 400));

                if (mediaType === 'image') {
                    await sock.sendMessage(destinoJid, { image: buffer });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(destinoJid, { video: buffer });
                } else if (mediaType === 'audio') {
                    await sock.sendMessage(destinoJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                }
                return;
            } catch (error) {
                console.error("❌ Error al rescatar por respuesta estricta:", error);
                return;
            }
        }

        if (!["ver", "vv", "rescatar", "verunavez"].includes(cmdLimpio)) return;

        // Si no tiene acceso (modo off y no eres dueño), silencio absoluto (no responde nada)
        if (!tieneAcceso) return;

        if (!quotedMsg) {
            return sock.sendMessage(chatId, { text: `⚠️ Responde al mensaje de "Ver una vez" con \`${prefijoUsado || '.'}${cmdLimpio}\` o usa 🔥 / 👍.` }, { quoted: msg });
        }

        try {
            let innerMsg = quotedMsg.viewOnceMessage?.message ||
                           quotedMsg.viewOnceMessageV2?.message ||
                           quotedMsg.viewOnceMessageV2Extension?.message ||
                           quotedMsg;                                                                                                                   
            let mediaType = null;
            let messageWrapper = null;

            if (innerMsg.imageMessage) {
                mediaType = 'image';
                messageWrapper = { message: { imageMessage: innerMsg.imageMessage } };
            } else if (innerMsg.videoMessage) {
                mediaType = 'video';
                messageWrapper = { message: { videoMessage: innerMsg.videoMessage } };
            } else if (innerMsg.audioMessage) {
                mediaType = 'audio';
                messageWrapper = { message: { audioMessage: innerMsg.audioMessage } };
            } else if (quotedMsg.imageMessage) {
                mediaType = 'image';
                messageWrapper = { message: { imageMessage: quotedMsg.imageMessage } };
            } else if (quotedMsg.videoMessage) {
                mediaType = 'video';
                messageWrapper = { message: { videoMessage: quotedMsg.videoMessage } };
            } else if (quotedMsg.audioMessage) {
                mediaType = 'audio';
                messageWrapper = { message: { audioMessage: quotedMsg.audioMessage } };
            }

            if (!mediaType || !messageWrapper) {
                return sock.sendMessage(chatId, { text: `⚠️ El mensaje citado no es un archivo válido de "Ver una vez".` }, { quoted: msg });
            }

            let buffer = await downloadMediaMessage(
                messageWrapper,
                'buffer',
                {},
                { logger: console }
            );

            let txtCaption = `「✿」 *[ ᴀʀᴄʜɪᴠᴏ ᴅᴇ "ᴠᴇʀ ᴜɴᴀ ᴠᴇᴢ" ʀᴇꜱᴄᴀᴛᴀᴅᴏ ]* 🜲`;

            if (mediaType === 'image') {
                await sock.sendMessage(chatId, { image: buffer, caption: txtCaption }, { quoted: msg });
            } else if (mediaType === 'video') {
                await sock.sendMessage(chatId, { video: buffer, caption: txtCaption }, { quoted: msg });
            } else if (mediaType === 'audio') {
                await sock.sendMessage(chatId, { audio: buffer, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
            }

        } catch (error) {
            console.error("Error al rescatar por comando:", error);
            return sock.sendMessage(chatId, { text: `⚠️ Error al procesar el archivo multimedia.` }, { quoted: msg });
        }
    }
};
