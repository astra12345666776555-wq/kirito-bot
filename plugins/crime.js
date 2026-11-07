import fs from 'fs';

function cargarConfig() {
    try {
        const data = JSON.parse(fs.readFileSync('./config_juego.json', 'utf-8'));
        return data;
    } catch (e) {
        return { crimenes: [], tienda: { armas: [], vehiculos: [] } };
    }
}

function calcularBonoArmasVehiculos(uGrupo, configJuego) {
    let bono = 0;
    if (!uGrupo.inventario || !Array.isArray(uGrupo.inventario)) return bono;
    const armas = configJuego.tienda?.armas || [];
    const vehiculos = configJuego.tienda?.vehiculos || [];

    uGrupo.inventario.forEach(item => {
        const arma = armas.find(a => a.nombre.toLowerCase() === item.toLowerCase());
        if (arma && arma.bonoCrimen) bono += arma.bonoCrimen;

        const vehiculo = vehiculos.find(v => v.nombre.toLowerCase() === item.toLowerCase());
        if (vehiculo && vehiculo.bonoCrimen) bono += vehiculo.bonoCrimen;
    });
    return bono;
}

export default {
    name: "crime",
    description: "Menú de crímenes con bonificación local por armas y vehículos de cada grupo",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        if (comando === 'crime' || comando === 'crimen') {
            // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
            if (!chatId.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '⚠️ El sistema de crímenes solo está disponible dentro de los grupos.' }, { quoted: msg });
            }

            // Inicializar base de datos local del grupo
            if (!db.grupos) db.grupos = {};
            if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
            if (!db.grupos[chatId].usuarios[senderJid]) {
                db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0, inventario: [] };
            }

            let uGrupo = db.grupos[chatId].usuarios[senderJid];
            const configJuego = cargarConfig();
            const CRIMENES = configJuego.crimenes || [];
            const idCrimen = parseInt(args[0]);

            const bonoTotal = calcularBonoArmasVehiculos(uGrupo, configJuego);

            if (isNaN(idCrimen)) {
                let txtCrime = `╭━━━ 🎭 ❮ MENÚ DE CRÍMENES (LOCAL) ❯ 🎭 ━━━╮\n`;
                txtCrime += `┃\n`;
                if (bonoTotal > 0) {
                    txtCrime += `┃ ⚔️ *Bono activo por equipo:* +${bonoTotal}% de éxito\n`;
                } else {
                    txtCrime += `┃ ⚠️ *Sin equipo táctico en este grupo*\n`;
                }
                txtCrime += `┃\n`;
                txtCrime += `┣━━━ 📋 *LISTA DE GOLPES:* ━━━\n`;

                CRIMENES.forEach(c => {
                    const probBase = c.probBase || 50;
                    const probFinal = Math.min(probBase + bonoTotal, 100);
                    txtCrime += `┃ 🔹 *ID ${c.id}* - ${c.nombre}\n`;
                    txtCrime += `┃    💰 Botín: ${formatoMoneda(c.minGain)} - ${formatoMoneda(c.maxGain)}\n`;
                    txtCrime += `┃    🚨 Multa: ${formatoMoneda(c.multa)} | Éxito: *${probFinal}%*\n`;
                });

                txtCrime += `┃\n`;
                txtCrime += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
                txtCrime += `> 💡 _Uso: \`${prefijoUsado}crime <id>\` (Cooldown independiente por grupo)_`;

                return sock.sendMessage(chatId, { text: txtCrime, mentions: [senderJid] }, { quoted: msg });
            }

            const crimenElegido = CRIMENES.find(c => c.id === idCrimen);
            if (!crimenElegido) {
                return sock.sendMessage(chatId, { text: `❌ ID de crimen no válido. Revisa \`${prefijoUsado}crime\`.` }, { quoted: msg });
            }

            const ahora = Date.now();
            const tiempoEspera = 8 * 60 * 1000; // 8 minutos

            if (ahora - (uGrupo.ultimoCrimen || 0) < tiempoEspera) {
                const restante = Math.ceil((tiempoEspera - (ahora - uGrupo.ultimoCrimen)) / 1000);
                return sock.sendMessage(chatId, { text: `🚨 Estás bajo sospecha en este grupo. Espera *${Math.floor(restante / 60)}m ${restante % 60}s* para volver a golpear.`, mentions: [senderJid] }, { quoted: msg });
            }

            uGrupo.ultimoCrimen = ahora;

            const probabilidadReal = Math.min((crimenElegido.probBase || 50) + bonoTotal, 100);
            const exito = Math.random() * 100 < probabilidadReal;

            const botin = Math.floor(Math.random() * (crimenElegido.maxGain - crimenElegido.minGain + 1)) + crimenElegido.minGain;
            const multa = crimenElegido.multa || 500;

            if (exito) {
                uGrupo.cartera = (uGrupo.cartera || 0) + botin;
                if (typeof guardarDB === 'function') guardarDB();
                return sock.sendMessage(chatId, { text: `🔫 *¡CRIMEN EXITOSO!* (${probabilidadReal}% de éxito) Conquistaste ${formatoMoneda(botin)} para tu cartera local.`, mentions: [senderJid] }, { quoted: msg });
            } else {
                uGrupo.cartera = (uGrupo.cartera || 0) - multa;
                if (typeof guardarDB === 'function') guardarDB();
                return sock.sendMessage(chatId, { text: `🚓 *¡TE ATRAPARON!* (${probabilidadReal}% de éxito) Pagaste ${formatoMoneda(multa)} de fianza local a la policía.`, mentions: [senderJid] }, { quoted: msg });
            }
        }
    }
};
