import fs from 'fs';

function cargarConfig() {
    try {
        const data = JSON.parse(fs.readFileSync('./config_juego.json', 'utf-8'));
        return data;
    } catch (e) {
        return { estafas: [] };
    }
}

export default {
    name: "estafar",
    description: "Sistema de fraudes y estafas local por grupo con cooldown de 10m y tope interno de 50%",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== 'estafar') return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El sistema de estafas y fraudes solo opera dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0, ultimaEstafa: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        const configJuego = cargarConfig();
        const LISTA_ESTAFAS = configJuego.estafas || [
            { id: 1, nombre: "Vender boletos falsos de concierto 🎟️", minGain: 500, maxGain: 1200, multa: 800, xp: 20, probBase: 65 },
            { id: 2, nombre: "Criptoestafa piramidal digital 📈", minGain: 1500, maxGain: 3500, multa: 2500, xp: 45, probBase: 62 },
            { id: 3, nombre: "Falsa lotería internacional 🌐", minGain: 4000, maxGain: 9000, multa: 6000, xp: 80, probBase: 58 }
        ];

        const idEstafa = parseInt(args[0]);
        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        if (isNaN(idEstafa)) {
            let txtEstafas = `╭━━━ 🕵️ ❮ RED DE FRAUDES Y ESTAFAS (LOCAL) ❯ 🕵️ ━━━╮\n`;
            txtEstafas += `┃\n`;
            LISTA_ESTAFAS.forEach(e => {
                const probVisual = Math.min(e.probBase || 50, 50);
                txtEstafas += `┃ 🔹 *ID ${e.id}* - ${e.nombre}\n`;
                txtEstafas += `┃    💰 Botín: ${formatoMoneda(e.minGain)} - ${formatoMoneda(e.maxGain)}\n`;
                txtEstafas += `┃    🚨 Multa: ${formatoMoneda(e.multa)} | Éxito: *${probVisual}%*\n`;
            });
            txtEstafas += `┃\n`;
            txtEstafas += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
            txtEstafas += `> 💡 _Uso: \`${prefijoUsado}estafar <id>\` (Cooldown de 10m por grupo)_`;

            return sock.sendMessage(chatId, { text: txtEstafas, mentions: [senderJid] }, { quoted: msg });
        }

        const estafaElegida = LISTA_ESTAFAS.find(e => e.id === idEstafa);
        if (!estafaElegida) {
            return sock.sendMessage(chatId, { text: `❌ ID de estafa no válido en este grupo.` }, { quoted: msg });
        }

        const ahora = Date.now();
        const COOLDOWN_ESTAFA = 10 * 60 * 1000; // 10 minutos

        if (ahora - (uGrupo.ultimaEstafa || 0) < COOLDOWN_ESTAFA) {
            const restante = Math.ceil((COOLDOWN_ESTAFA - (ahora - uGrupo.ultimaEstafa)) / 1000);
            return sock.sendMessage(chatId, { text: `🚨 La policía sigue rastreando tu IP en este grupo. Espera *${Math.floor(restante / 60)}m ${restante % 60}s* para volver a estafar.`, mentions: [senderJid] }, { quoted: msg });
        }

        uGrupo.ultimaEstafa = ahora;

        // TOPE REAL INTERNO DE 50%
        const probabilidadReal = Math.min(estafaElegida.probBase || 50, 50);
        const exito = Math.random() * 100 < probabilidadReal;

        const botinGanado = Math.floor(Math.random() * (estafaElegida.maxGain - estafaElegida.minGain + 1)) + estafaElegida.minGain;

        if (exito) {
            uGrupo.cartera = (uGrupo.cartera || 0) + botinGanado;
            uGrupo.xp = (uGrupo.xp || 0) + (estafaElegida.xp || 20);
            if (typeof guardarDB === "function") guardarDB();

            let txtExito = `╭━━━ 🕵️‍♂️ ❮ ESTAFA EXITOSA (LOCAL) ❯ 🕵️‍♂️ ━━━╮\n`;
            txtExito += `┃\n`;
            txtExito += `┃ 👤 ${tagUser} ejecutó con éxito *${estafaElegida.nombre}*.\n`;
            txtExito += `┃ 🪙 Ganancia: *+${formatoMoneda(botinGanado)}* (Cartera local)\n`;
            txtExito += `┃ ⭐ Experiencia: *+${estafaElegida.xp || 20} XP*\n`;
            txtExito += `┃\n`;
            txtExito += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtExito, mentions: [senderJid] }, { quoted: msg });
        } else {
            const multa = estafaElegida.multa || 500;
            uGrupo.cartera = (uGrupo.cartera || 0) - multa;
            if (typeof guardarDB === "function") guardarDB();

            let txtFallo = `╭━━━ 🚨 ❮ CAÍSTE EN LA TRAMPA ❯ 🚨 ━━━╮\n`;
            txtFallo += `┃\n`;
            txtFallo += `┃ 👤 ${tagUser}, la ciberpolicía descubrió tu fraude en *${estafaElegida.nombre}*.\n`;
            txtFallo += `┃ 💸 Multa pagada: *-${formatoMoneda(multa)}* (De tu cartera local)\n`;
            txtFallo += `┃\n`;
            txtFallo += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtFallo, mentions: [senderJid] }, { quoted: msg });
        }
    }
};
