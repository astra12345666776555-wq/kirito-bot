export default {
    name: "grupo",
    description: "Abre o cierra el grupo permitiendo que el dueño o administradores modifiquen los ajustes.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["abrir", "cerrar", "open", "close"].includes(cmdLimpio)) return;

        try {
            // 1. Validar si el chat es un grupo
            if (!chatId.endsWith("@g.us")) {
                return await sock.sendMessage(chatId, { text: "❌ Este comando solo se puede usar dentro de grupos." }, { quoted: msg });
            }

            // 2. Validar si eres el Dueño configurado o Administrador
            let ownerJid = CONFIG.OWNER_NUMBER + "@s.whatsapp.net";
            let esDueño = senderJid === ownerJid;
            let esAdminGrupo = false;

            let groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
            if (groupMetadata) {
                let participants = groupMetadata.participants || [];
                let userAdminCheck = participants.find(p => p.id === senderJid)?.admin;
                if (userAdminCheck) esAdminGrupo = true;
            }

            if (!esDueño && !esAdminGrupo) {
                return await sock.sendMessage(chatId, { text: "❌ Solo los administradores o el dueño pueden abrir o cerrar el grupo." }, { quoted: msg });
            }

            // 3. Ejecutar la acción directamente ignorando bloqueos de rol del bot
            if (["abrir", "open"].includes(cmdLimpio)) {
                await sock.groupSettingUpdate(chatId, "not_announcement");
                await sock.sendMessage(chatId, { text: "🔓 *¡Grupo Abierto!* Ahora todos los participantes pueden enviar mensajes." }, { quoted: msg });
            } else if (["cerrar", "close"].includes(cmdLimpio)) {
                await sock.groupSettingUpdate(chatId, "announcement");
                await sock.sendMessage(chatId, { text: "🔒 *¡Grupo Cerrado!* Ahora solo los administradores pueden enviar mensajes." }, { quoted: msg });
            }

        } catch (e) {
            console.error("Error en plugin grupo (abrir/cerrar):", e);
            await sock.sendMessage(chatId, { text: "❌ Asegúrate de que el bot sea administrador en los ajustes de WhatsApp del grupo para poder aplicar cambios." }, { quoted: msg });
        }
    }
};
