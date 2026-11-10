import fs from "fs";

export default {
    name: "ruletamuerte",
    description: "Duelo mortal de ruleta rusa PvP local por grupo donde el ganador depende del arma equipada y nivel",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "ruletamuerte") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Los duelos de ruleta mortal solo se pueden jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, inventario: [] };
        }

        let uSender = db.grupos[chatId].usuarios[senderJid];

        let mencion = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        let apuesta = parseInt(args[1] || args[0]);

        if (!mencion || mencion.includes("undefined") || mencion.length < 10 || isNaN(apuesta) || apuesta <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}ruletamuerte @usuario [apuesta]\`\nEjemplo: \`${prefijoUsado}ruletamuerte @usuario 5000\`` }, { quoted: msg });
        }

        if (mencion === senderJid) {
            return sock.sendMessage(chatId, { text: "❌ No puedes retarte a muerte a ti mismo, busca un rival digno. 😅" }, { quoted: msg });
        }

        // Inicializar al rival en el grupo si no existe
        if (!db.grupos[chatId].usuarios[mencion]) {
            db.grupos[chatId].usuarios[mencion] = { cartera: 0, banco: 0, nivel: 1, inventario: [] };
        }
        let uRival = db.grupos[chatId].usuarios[mencion];

        if ((uSender.cartera || 0) < apuesta) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficientes Cols en tu cartera local para esta apuesta mortal (*Tienes:* ${formatoMoneda(uSender.cartera || 0)}).` }, { quoted: msg });
        }
        if ((uRival.cartera || 0) < apuesta) {
            return sock.sendMessage(chatId, { text: `❌ El usuario mencionado no tiene suficientes Cols en su cartera local para cubrir la apuesta.` }, { quoted: msg });
        }

        // --- SISTEMA DE COMBATE BASADO EN ARMAS Y NIVEL ---
        // Cargar config de armas para ver sus bonos o calcular poder
        let juegoConfig = {};
        try {
            if (fs.existsSync("./config_juego.json")) {
                juegoConfig = JSON.parse(fs.readFileSync("./config_juego.json", "utf8"));
            }
        } catch (e) {}
        let listaArmas = juegoConfig.tienda?.armas || [];

        // Calcular poder del emisor
        let poderSender = (uSender.nivel || 1) * 10;
        if (Array.isArray(uSender.inventario)) {
            uSender.inventario.forEach(itemNombre => {
                let nombreItem = String(typeof itemNombre === "string" ? itemNombre : (itemNombre?.nombre || itemNombre?.name || "")).toLowerCase(); let armaData = listaArmas.find(a => String(a.nombre).toLowerCase() === nombreItem);
                if (armaData) {
                    poderSender += (armaData.bonoCrimen || 10) * 5;
                }
            });
        }

        // Calcular poder del rival
        let poderRival = (uRival.nivel || 1) * 10;
        if (Array.isArray(uRival.inventario)) {
            uRival.inventario.forEach(itemNombre => {
                let nombreItem = String(typeof itemNombre === "string" ? itemNombre : (itemNombre?.nombre || itemNombre?.name || "")).toLowerCase(); let armaData = listaArmas.find(a => String(a.nombre).toLowerCase() === nombreItem);
                if (armaData) {
                    poderRival += (armaData.bonoCrimen || 10) * 5;
                }
            });
        }

        // Probabilidad ponderada basada en poder
        let totalPoder = poderSender + poderRival;
        let probabilidadSender = totalPoder > 0 ? (poderSender / totalPoder) : 0.5;

        // Descontar apuestas de ambos
        uSender.cartera -= apuesta;
        uRival.cartera -= apuesta;

        let ganador = Math.random() < probabilidadSender ? senderJid : mencion;
        let perdedor = ganador === senderId ? mencion : senderId;
        let pozoTotal = apuesta * 2;

        let uGanador = db.grupos[chatId].usuarios[ganador];
        uGanador.cartera = (uGanador.cartera || 0) + pozoTotal;

        // 📋 Registrar avance en las Misiones Diarias del grupo para el emisor
        if (!uSender.misionesDiarias) {
            uSender.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, monedasJugadas: 0, palabrasOrdenadas: 0, pptJugados: 0, rapidoJugados: 0, ruletaJugadas: 0, ruletaMuerteJugadas: 0, reclamado: false };
        }
        if (uSender.misionesDiarias.ruletaMuerteJugadas === undefined) {
            uSender.misionesDiarias.ruletaMuerteJugadas = 0;
        }
        uSender.misionesDiarias.ruletaMuerteJugadas++;

        if (typeof guardarDB === "function") guardarDB();

        let tagGanador = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(ganador) : "@" + ganador.split("@")[0];
        let tagPerdedor = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(perdedor) : "@" + perdedor.split("@")[0];
        let tagSender = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];
        let tagMencion = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(mencion) : "@" + mencion.split("@")[0];

        let txt = `╭━━━ 💀 ❮ DUELO MORTAL DE RULETA RUSA ❯ 💀 ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👥 *Retador:* ${tagSender} vs *Rival:* ${tagMencion}\n`;
        txt += `┃ 🔫 Los tambores giraron con tensión y el gatillo fue jalado...\n`;
        txt += `┃\n`;
        txt += `┃ 🏆 *Superviviente:* ${tagGanador}\n`;
        txt += `┃ 🪙 *Botín arrebatado:* +${formatoMoneda(pozoTotal)}\n`;
        txt += `┃ ⚰️ *Derrotado:* ${tagPerdedor}\n`;
        txt += `┃\n`;
        txt += `> 📋 _Progreso de misión actualizado (+1 duelo mortal)_\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        return sock.sendMessage(chatId, { text: txt, mentions: [ganador, perdedor, senderJid, mencion] }, { quoted: msg });
    }
};
