import fs from "fs";

export default {
    name: "toprandom",
    description: "Genera un top aleatorio de hasta 10 miembros del grupo con un título personalizado",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "toprandom") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando solo se puede usar dentro de los grupos.' }, { quoted: msg });
        }

        let mensajeCustom = args.join(" ").trim() || "Top de cracks al azar";

        try {
            let metadata = await sock.groupMetadata(chatId);
            let participantes = metadata.participants.map(p => p.id);

            if (participantes.length === 0) {
                return sock.sendMessage(chatId, { text: '❌ No se pudieron obtener los participantes del grupo.' }, { quoted: msg });
            }

            // Barajar al azar y tomar máximo 10 participantes
            let seleccionados = participantes.sort(() => 0.5 - Math.random()).slice(0, 10);

            let txt = `╭━━━ 🌟 ❮ ${mensajeCustom.toUpperCase()} ❯ 🌟 ━━━╮\n`;
            txt += `┃\n`;

            seleccionados.forEach((id, index) => {
                let medalla = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🎖️";
                let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(id) : "@" + id.split("@")[0];

                txt += `┃ ${medalla} *${index + 1}.* ${tagUser}\n`;
            });

            txt += `┃\n`;
            txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txt, mentions: seleccionados }, { quoted: msg });

        } catch (e) {
            return sock.sendMessage(chatId, { text: "❌ Ocurrió un error al generar el top aleatorio en este grupo." }, { quoted: msg });
        }
    }
};
