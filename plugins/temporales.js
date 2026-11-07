export default {
    name: "temporales",
    description: "Configura o deshabilita los mensajes temporales del grupo.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["temporal", "temporales", "disappearing"].includes(cmdLimpio)) return;

        try {
            // 1. Validar si el chat es un grupo
            if (!chatId.endsWith("@g.us")) {
                return await sock.sendMessage(chatId, { text: "❌ Este comando solo se puede usar dentro de grupos." }, { quoted: msg });
            }

            // 2. Validar permisos (Dueño o Administrador por número / metadatos)
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
                return await sock.sendMessage(chatId, { text: "❌ Solo los administradores o el dueño pueden configurar los mensajes temporales." }, { quoted: msg });
            }

            // 3. Interpretar el argumento de tiempo
            let tiempoArg = (args[0] || "").toLowerCase();
            let duracionSegundos = 0;
            let mensajeTexto = "";

            if (["off", "apagar", "desactivar", "0"].includes(tiempoArg)) {
                duracionSegundos = 0; // Desactivar
                mensajeTexto = "⏳ *Mensajes temporales desactivados* para este grupo.";
            } else if (["24h", "1dia", "dia", "86400"].includes(tiempoArg)) {
                duracionSegundos = 86400; // 24 horas
                mensajeTexto = "⏱️ *Mensajes temporales ajustados a 24 horas*.";
            } else if (["7d", "7dias", "sem", "604800"].includes(tiempoArg)) {
                duracionSegundos = 604800; // 7 días
                mensajeTexto = "⏱️ *Mensajes temporales ajustados a 7 días*.";
            } else if (["90d", "90dias", "7776000"].includes(tiempoArg)) {
                duracionSegundos = 7776000; // 90 días
                mensajeTexto = "⏱️ *Mensajes temporales ajustados a 90 días*.";
            } else {
                return await sock.sendMessage(chatId, { 
                    text: `⚠️ *Uso correcto del comando*:\n\n• \`${prefijoUsado}temporales 24h\` (24 horas)\n• \`${prefijoUsado}temporales 7d\` (7 días)\n• \`${prefijoUsado}temporales 90d\` (90 días)\n• \`${prefijoUsado}temporales off\` (Desactivar)` 
                }, { quoted: msg });
            }

            // 4. Aplicar el cambio en WhatsApp directamente
            await sock.groupToggleEphemeral(chatId, duracionSegundos);
            await sock.sendMessage(chatId, { text: mensajeTexto }, { quoted: msg });

        } catch (e) {
            console.error("Error en plugin temporales:", e);
            await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al intentar cambiar los mensajes temporales." }, { quoted: msg });
        }
    }
};
