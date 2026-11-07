export default {
    name: "config",
    description: "Configuración global de prefijos y moneda del bot (Solo Dueño).",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        // Validar que solo el Dueño pueda usar estos comandos de configuración global
        let ownerNum = String(CONFIG.OWNER_NUMBER || "51947497514").replace(/[^0-9]/g, '');
        let jidStr = typeof senderJid === 'string' ? senderJid : (senderJid?.remoteJid || senderJid?.id || String(senderJid || ""));
        let senderNum = jidStr.replace(/[^0-9]/g, '');
        let esDueño = senderNum === ownerNum || jidStr.includes(ownerNum);

        if (!esDueño) return;

        db.global = db.global || {};
        if (!db.global.prefijos || !Array.isArray(db.global.prefijos)) {
            db.global.prefijos = CONFIG.PREFIXOS || [".", "!"];
        }
        if (!db.global.moneda) {
            db.global.moneda = { simbolo: "🪙", nombre: "coins" };
        }

        // --- GESTIÓN DE PREFIJOS (.prefijo) ---
        if (["prefijo", "prefijos", "prefix"].includes(cmdLimpio)) {
            let accion = (args[0] || "").toLowerCase();
            let valor = args[1] ? args[1].trim() : "";

            if (!accion || accion === "ver") {
                return sock.sendMessage(chatId, { 
                    text: `⚙️ *CONFIGURACIÓN DE PREFIJOS*:\n\n• Prefijos actuales: \`${db.global.prefijos.join(", ")}\`\n\n📌 *Opciones*:\n- \`${prefijoUsado}prefijo agregar <símbolo>\`\n- \`${prefijoUsado}prefijo eliminar <símbolo>\`` 
                }, { quoted: msg });
            }

            if (accion === "agregar" || accion === "add") {
                if (!valor) return sock.sendMessage(chatId, { text: `⚠️ Escribe el símbolo a agregar. Ej: \`${prefijoUsado}prefijo agregar /\`` }, { quoted: msg });
                if (db.global.prefijos.includes(valor)) {
                    return sock.sendMessage(chatId, { text: `⚠️ El prefijo \`${valor}\` ya existe.` }, { quoted: msg });
                }

                db.global.prefijos.push(valor);
                CONFIG.PREFIXOS = db.global.prefijos;
                if (typeof guardarDB === "function") guardarDB();
                return sock.sendMessage(chatId, { text: `✅ ¡Prefijo \`${valor}\` agregado!\nLista: \`${db.global.prefijos.join(", ")}\`` }, { quoted: msg });
            }

            if (accion === "eliminar" || accion === "del" || accion === "quitar") {
                if (!valor) return sock.sendMessage(chatId, { text: `⚠️ Escribe el prefijo a eliminar.` }, { quoted: msg });
                if (db.global.prefijos.length <= 1) {
                    return sock.sendMessage(chatId, { text: `❌ El bot necesita al menos un prefijo.` }, { quoted: msg });
                }

                let index = db.global.prefijos.indexOf(valor);
                if (index === -1) return sock.sendMessage(chatId, { text: `❌ El prefijo \`${valor}\` no se encuentra.` }, { quoted: msg });

                db.global.prefijos.splice(index, 1);
                CONFIG.PREFIXOS = db.global.prefijos;
                if (typeof guardarDB === "function") guardarDB();
                return sock.sendMessage(chatId, { text: `🗑️ ¡Prefijo \`${valor}\` eliminado!\nLista: \`${db.global.prefijos.join(", ")}\`` }, { quoted: msg });
            }
        }

        // --- GESTIÓN DE MONEDA (.vermoneda, .setsimbolo, .setmoneda) ---
        if (cmdLimpio === "vermoneda") {
            return sock.sendMessage(chatId, { 
                text: `💰 *CONFIGURACIÓN DE MONEDA*:\n\n• Símbolo actual: ${db.global.moneda.simbolo}\n• Nombre actual: *${db.global.moneda.nombre}*\n\n📌 *Comandos para cambiar*:\n- \`${prefijoUsado}setsimbolo 💎\`\n- \`${prefijoUsado}setmoneda yenes\`` 
            }, { quoted: msg });
        }

        if (cmdLimpio === "setsimbolo") {
            let nuevoSimbolo = args[0] ? args[0].trim() : "";
            if (!nuevoSimbolo) return sock.sendMessage(chatId, { text: `⚠️ Escribe el nuevo símbolo. Ej: \`${prefijoUsado}setsimbolo 💎\`` }, { quoted: msg });

            db.global.moneda.simbolo = nuevoSimbolo;
            if (typeof guardarDB === "function") guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Símbolo de moneda actualizado a: ${db.global.moneda.simbolo}!` }, { quoted: msg });
        }

        if (cmdLimpio === "setmoneda") {
            let nuevoNombre = args.join(" ").trim();
            if (!nuevoNombre) return sock.sendMessage(chatId, { text: `⚠️ Escribe el nuevo nombre. Ej: \`${prefijoUsado}setmoneda yenes\`` }, { quoted: msg });

            db.global.moneda.nombre = nuevoNombre;
            if (typeof guardarDB === "function") guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Nombre de la moneda actualizado a: *${db.global.moneda.nombre}*!` }, { quoted: msg });
        }
    }
};
