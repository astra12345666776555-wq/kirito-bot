export default {
    name: "cripto",
    description: "Mercado global de KiritoCoin (KRT) con fluctuación aleatoria y portafolio local por grupo",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "cripto") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El mercado de KiritoCoin solo opera dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, krt: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];
        if (uGrupo.krt === undefined) uGrupo.krt = 0; // Monedero local de KRT

        // 🌐 PRECIO GLOBAL Y FLUCTUACIÓN ALEATORIA (5 a 10 minutos)
        const ahora = Date.now();
        const intervaloFluc = 5 * 60 * 1000; // 5 minutos mínimos

        if (!global.krtPrecioGlobal) {
            global.krtPrecioGlobal = 1000; // Valor inicial
            global.krtUltimaActualizacion = ahora;
        } else {
            // Si ya pasaron al menos 5 minutos desde la última fluctuación global
            if (ahora - (global.krtUltimaActualizacion || 0) >= intervaloFluc) {
                let subeBaja = Math.random() < 0.5; // 50% probabilidad de subir o bajar
                let porcentajeVar = (Math.random() * 20) / 100; // 0% a 20% de variación

                let cambio = global.krtPrecioGlobal * porcentajeVar;
                if (subeBaja) {
                    global.krtPrecioGlobal += cambio;
                } else {
                    global.krtPrecioGlobal -= cambio;
                }

                // Respetar límites estrictos: Mínimo 100 Cols, Máximo 5000 Cols
                global.krtPrecioGlobal = Math.max(100, Math.min(5000, Math.floor(global.krtPrecioGlobal)));
                global.krtUltimaActualizacion = ahora;
            }
        }

        let precioKrt = global.krtPrecioGlobal;
        let accion = (args[0] || "").toLowerCase();
        let cantidad = parseInt(args[1]) || 1;

        // Si solo escribe .cripto, mostrar mercado y portafolio local
        if (!["comprar", "vender"].includes(accion)) {
            let txtMercado = `╭━━━ 🪙 ❮ MERCADO KIRITOCOIN (KRT) ❯ 🪙 ━━━╮\n`;
            txtMercado += `┃\n`;
            txtMercado += `┃ 📈 *Precio Actual Global:* *${precioKrt.toLocaleString()} Cols*\n`;
            txtMercado += `┃ 📉 *Límites:* Min 100 | Max 5,000 Cols\n`;
            txtMercado += `┃\n`;
            txtMercado += `┣━━━ 💼 *TU PORTAFOLIO EN ESTE GRUPO:* ━━━\n`;
            txtMercado += `┃ 🪙 *KRT Tenidos:* *${uGrupo.krt} KRT*\n`;
            txtMercado += `┃ 💵 *Valor en Cartera:* ${formatoMoneda(uGrupo.krt * precioKrt)}\n`;
            txtMercado += `┃\n`;
            txtMercado += `┣━━━ 🕹️ *COMANDOS DISPONIBLES:* ━━━\n`;
            txtMercado += `┃ • \`${prefijoUsado}cripto comprar <cantidad>\`\n`;
            txtMercado += `┃ • \`${prefijoUsado}cripto vender <cantidad>\`\n`;
            txtMercado += `┃\n`;
            txtMercado += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtMercado, mentions: [senderJid] }, { quoted: msg });
        }

        if (isNaN(cantidad) || cantidad <= 0) {
            return sock.sendMessage(chatId, { text: "⚠️ Debes especificar una cantidad válida mayor a 0." }, { quoted: msg });
        }

        let costoTotal = precioKrt * cantidad;

        if (accion === "comprar") {
            if ((uGrupo.cartera || 0) < costoTotal) {
                return sock.sendMessage(chatId, { text: `❌ No tienes suficientes Cols en tu cartera local. Necesitas *${formatoMoneda(costoTotal)}*.` }, { quoted: msg });
            }

            uGrupo.cartera -= costoTotal;
            uGrupo.krt += cantidad;
            if (typeof guardarDB === "function") guardarDB();

            let txtCompra = `╭━━━ ✅ ❮ COMPRA EXITOSA (KRT) ❯ ✅ ━━━╮\n`;
            txtCompra += `┃\n`;
            txtCompra += `┃ Adquiriste *${cantidad} KRT* por un total de *${formatoMoneda(costoTotal)}*.\n`;
            txtCompra += `┃ 🪙 *Precio unitario:* ${formatoMoneda(precioKrt)}\n`;
            txtCompra += `┃\n`;
            txtCompra += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtCompra, mentions: [senderJid] }, { quoted: msg });
        }

        if (accion === "vender") {
            if (uGrupo.krt < cantidad) {
                return sock.sendMessage(chatId, { text: `❌ No tienes esa cantidad de KiritoCoins en este grupo. Tienes: *${uGrupo.krt} KRT*.` }, { quoted: msg });
            }

            uGrupo.krt -= cantidad;
            uGrupo.cartera = (uGrupo.cartera || 0) + costoTotal;
            if (typeof guardarDB === "function") guardarDB();

            let txtVenta = `╭━━━ ✅ ❮ VENTA EXITOSA (KRT) ❯ ✅ ━━━╮\n`;
            txtVenta += `┃\n`;
            txtVenta += `┃ Vendiste *${cantidad} KRT* y obtuviste *${formatoMoneda(costoTotal)}* para tu cartera local.\n`;
            txtVenta += `┃ 🪙 *Precio unitario:* ${formatoMoneda(precioKrt)}\n`;
            txtVenta += `┃\n`;
            txtVenta += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtVenta, mentions: [senderJid] }, { quoted: msg });
        }
    }
};
