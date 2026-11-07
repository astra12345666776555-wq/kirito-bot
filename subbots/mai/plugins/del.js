// Almacén temporal en memoria para los mensajes recientes por chat
global.recentMessages = global.recentMessages || {};

// 🧹 Limpieza automática diaria de la caché en memoria (cada 24 horas)
if (!global._delCacheInterval) {
    global._delCacheInterval = setInterval(() => {
        global.recentMessages = {};
        console.log("🧹 [AUTOLIMPIEZA]: Caché de mensajes de .del borrada y optimizada.");
    }, 24 * 60 * 60 * 1000); // 24 horas en milisegundos
}

export default {
    name: "del",
    description: "Borra mensajes individuales (respondiendo) o masivos por cantidad (.del <num>) con caché autolimpiable.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "del" && cmdLimpio !== "delete") return;

        try {
            // 1. Guardar el mensaje actual en el búfer del chat automáticamente
            if (!global.recentMessages[chatId]) global.recentMessages[chatId] = [];
            global.recentMessages[chatId].push(msg);
            
            // Mantener un límite de seguridad en memoria por chat (últimos 150 mensajes)
            if (global.recentMessages[chatId].length > 150) {
                global.recentMessages[chatId].shift();
            }

            // 2. Validar permisos (Dueño o Administrador)
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
                return await sock.sendMessage(chatId, { text: "❌ Solo los administradores o el dueño pueden usar este comando." }, { quoted: msg });
            }

            let quotedInfo = msg.message?.extendedTextMessage?.contextInfo;
            let quotedKey = quotedInfo ? {
                remoteJid: chatId,
                fromMe: quotedInfo.participant === sock.user.id || quotedInfo.participant === sock.remoteJid,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant
            } : null;

            let cantidadArg = parseInt(args[0]);

            // CASO A: .del respondiendo a un mensaje -> Borra el mensaje citado y el comando
            if (quotedKey && (isNaN(cantidadArg) || args.length === 0)) {
                await sock.sendMessage(chatId, { delete: quotedKey }).catch(() => {});
                await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {});
                return;
            }

            // CASO B: .del <número> -> Borra los últimos N mensajes almacenados en el búfer
            if (!isNaN(cantidadArg) && cantidadArg > 0) {
                let limite = Math.min(cantidadArg, 50); // Lote seguro de borrado
                
                // Borrar primero el mensaje del comando actual
                await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {});

                let historialChat = global.recentMessages[chatId] || [];
                // Tomar los últimos mensajes excluyendo el del comando actual
                let mensajesAEliminar = historialChat
                    .filter(m => m.key.id !== msg.key.id)
                    .slice(-limite);

                for (let m of mensajesAEliminar) {
                    if (m && m.key) {
                        await sock.sendMessage(chatId, { delete: m.key }).catch(() => {});
                    }
                }

                // Limpiar del array los mensajes que ya borramos
                global.recentMessages[chatId] = historialChat.filter(m => !mensajesAEliminar.some(del => del.key.id === m.key.id));
                return;
            }

            // Si se usa .del sin argumentos ni mensaje citado
            if (!quotedKey && args.length === 0) {
                return await sock.sendMessage(chatId, { text: `⚠️ *Uso correcto*:\n• Responde a un mensaje con \`${prefijoUsado}del\`\n• O usa \`${prefijoUsado}del <cantidad>\` (Ej: \`${prefijoUsado}del 5\`)\`` }, { quoted: msg });
            }

        } catch (e) {
            console.error("Error en plugin .del:", e);
            await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al intentar borrar los mensajes." }, { quoted: msg });
        }
    }
};
