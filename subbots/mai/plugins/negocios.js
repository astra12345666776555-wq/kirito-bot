import fs from 'fs';

function cargarConfig() {
    try {
        const data = JSON.parse(fs.readFileSync('./config_juego.json', 'utf-8'));
        return data;
    } catch (e) {
        return { tienda: { negocios: [] } };
    }
}

export default {
    name: "negocios",
    description: "Recolección exclusiva de negocios locales por grupo con acumulación por horas y cooldown dinámico",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!['recolectar', 'recoger'].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ La recolección de empresas y negocios solo se puede realizar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, negocios: {} };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];
        const configJuego = cargarConfig();
        const negociosTienda = configJuego.tienda?.negocios || [];

        if (!uGrupo.negocios || typeof uGrupo.negocios !== 'object') {
            uGrupo.negocios = {};
        }

        const negociosPoseidos = Object.entries(uGrupo.negocios).filter(([nombre, cant]) => {
            if (cant <= 0) return false;
            return negociosTienda.some(n => n.nombre.toLowerCase() === nombre.toLowerCase());
        });

        if (negociosPoseidos.length === 0) {
            return sock.sendMessage(chatId, { text: `🏢 No tienes ninguna empresa o negocio comprado en este grupo. Visita \`${prefijoUsado}shop negocios\` para invertir.` }, { quoted: msg });
        }

        const ahora = Date.now();
        const ultimaRecoleccion = uGrupo.ultimoRecoleccionNegocios || 0;
        const INTERVALO_MS = 60 * 60 * 1000; // 1 hora exacta por ciclo

        // Si es la primera vez que recolecta, inicializamos su marca de tiempo
        if (ultimaRecoleccion === 0) {
            uGrupo.ultimoRecoleccionNegocios = ahora;
            if (typeof guardarDB === "function") guardarDB();
            return sock.sendMessage(chatId, { text: `🏢 ¡Tus empresas han abierto sus puertas en este grupo! Comienzan a generar ganancias a partir de ahora (acumulables cada 1 hora).` }, { quoted: msg });
        }

        const tiempoTranscurrido = ahora - ultimaRecoleccion;

        if (tiempoTranscurrido < INTERVALO_MS) {
            const minFaltantes = Math.ceil((INTERVALO_MS - tiempoTranscurrido) / (1000 * 60));
            return sock.sendMessage(chatId, { text: `⏳ Tus empresas aún están produciendo su primer ciclo. Vuelve en *${minFaltantes} minutos* para recolectar.` }, { quoted: msg });
        }

        // Calcular cuántas horas completas (ciclos) han pasado (acumulable: 1h = 1x, 4h = 4x)
        const horasAcumuladas = Math.floor(tiempoTranscurrido / INTERVALO_MS);

        let gananciaBasePorHoraTotal = 0;
        let reporte = `╭━━━ 🏢 ❮ REPORTE DE NEGOCIOS (LOCAL) ❯ 🏢 ━━━╮\n`;
        reporte += `┃\n`;
        reporte += `┃ ⏱️ *Ciclos acumulados:* ${horasAcumuladas} hora(s)\n`;
        reporte += `┣━━━ 📊 *PRODUCCIÓN:* ━━━\n`;

        let index = 1;
        negociosPoseidos.forEach(([nombreNegocio, cantidad]) => {
            const negocioData = negociosTienda.find(n => n.nombre.toLowerCase() === nombreNegocio.toLowerCase());
            const gananciaUnitariaReal = negocioData ? (negocioData.gananciaHora || 150) : 150;
            const gananciaPorHoraNegocio = gananciaUnitariaReal * cantidad;
            
            gananciaBasePorHoraTotal += gananciaPorHoraNegocio;
            reporte += `┃ ${index}. ${nombreNegocio} (x${cantidad}) ➔ +${formatoMoneda(gananciaPorHoraNegocio)}/h\n`;
            index++;
        });

        const totalRecolectado = gananciaBasePorHoraTotal * horasAcumuladas;

        reporte += `┃\n`;
        reporte += `┣━━━ 💰 *TOTAL RECOLECTADO:* ━━━\n`;
        reporte += `┃ 🪙 *${formatoMoneda(totalRecolectado)}* (${horasAcumuladas}x acumulado)\n`;
        reporte += `┃\n`;
        reporte += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        // Actualizar cartera local y ajustar el tiempo dejando el sobrante para no perder segundos
        uGrupo.cartera = (uGrupo.cartera || 0) + totalRecolectado;
        uGrupo.ultimoRecoleccionNegocios = ahora - (tiempoTranscurrido % INTERVALO_MS); 
        if (typeof guardarDB === "function") guardarDB();

        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        return sock.sendMessage(chatId, {
            text: reporte,
            mentions: [senderJid]
        }, { quoted: msg });
    }
};
