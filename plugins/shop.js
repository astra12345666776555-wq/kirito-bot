import fs from 'fs';
import path from 'path';

export default {
    name: "shop",
    description: "Tienda modular por categorías con estética gótica, compra por cantidad y gestión de guardias/tiempo de protección",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["shop", "tienda"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0, guardianHasta: 0, inventario: [] };
        }
        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        let configJuego = {};
        try {
            const archivoPath = path.resolve("config_juego.json");
            if (fs.existsSync(archivoPath)) {
                configJuego = JSON.parse(fs.readFileSync(archivoPath, "utf8"));
            }
        } catch (e) {
            console.error("Error al leer config_juego.json en shop:", e);
        }

        const tiendaData = configJuego.tienda || {};
        const categoriasDisponibles = Object.keys(tiendaData).filter(cat => Array.isArray(tiendaData[cat]) && tiendaData[cat].length > 0);

        let arg1 = (args[0] || "").toLowerCase().trim();
        let arg2 = args[1];
        let arg3 = args[2];

        // 1. Mostrar categorías principales
        if (!arg1) {
            let txtShop = `「✿」 *ᴛɪᴇɴᴅᴀ ɢᴇɴᴇʀᴀʟ - ᴄᴀᴛᴇɢᴏʀíᴀꜱ*:\n\n`;
            let idx = 1;
            for (const cat of categoriasDisponibles) {
                txtShop += `✰ ${idx} » *${cat.toUpperCase()}* | Usa \`${prefijoUsado}shop ${cat}\`\n`;
                idx++;
            }
            txtShop += `\n> • ᴇꜱᴄʀɪʙᴇ \`${prefijoUsado}shop <categoría>\` ᴘᴀʀᴀ ᴠᴇʀ ʟᴏꜱ ᴀʀᴛíᴄᴜʟᴏꜱ.`;
            return sock.sendMessage(chatId, { text: txtShop }, { quoted: msg });
        }

        let categoriaSeleccionada = null;
        if (categoriasDisponibles.includes(arg1)) {
            categoriaSeleccionada = arg1;
        } else if (!isNaN(arg1)) {
            let indexNum = parseInt(arg1) - 1;
            if (indexNum >= 0 && indexNum < categoriasDisponibles.length) {
                categoriaSeleccionada = categoriasDisponibles[indexNum];
            }
        }

        // 2. Mostrar ítems de la categoría seleccionada
        if (categoriaSeleccionada && !arg2) {
            const listaItems = tiendaData[categoriaSeleccionada];
            let txtCat = `「✿」 *ᴄᴀᴛᴇɢᴏʀíᴀ: ${categoriaSeleccionada.toUpperCase()}*:\n\n`;

            let itemIdx = 1;
            for (const item of listaItems) {
                let nombreItem = item.nombre || item.name || "Objeto desconocido";
                let precioItem = item.precio || item.price || 0;
                let extraInfo = "";

                if (categoriaSeleccionada === "guardias") {
                    extraInfo = ` | Protección: ${item.tiempoProteccion}h`;
                } else if (categoriaSeleccionada === "armas" || categoriaSeleccionada === "vehiculos") {
                    extraInfo = ` | Bono: +${item.bonoCrimen}`;
                } else if (categoriaSeleccionada === "libros") {
                    extraInfo = ` | XP: +${item.xp}`;
                }

                txtCat += `✰ ${itemIdx} » *${nombreItem}*${extraInfo}\n`;
                txtCat += `\t\t ᴄᴏꜱᴛᴏ » *${formatoMoneda(precioItem)}* | Usa \`${prefijoUsado}shop ${categoriaSeleccionada} ${itemIdx} [cantidad]\`\n`;
                itemIdx++;
            }
            txtCat += `\n> • ᴇᴊᴇᴍᴘʟᴏ ᴅᴇ ᴄᴏᴍᴘʀᴀ: \`${prefijoUsado}shop ${categoriaSeleccionada} 1 1\``;
            return sock.sendMessage(chatId, { text: txtCat }, { quoted: msg });
        }

        // 3. Procesar compra
        if (categoriaSeleccionada && arg2) {
            let itemIndex = parseInt(arg2) - 1;
            let cantidad = parseInt(arg3) || 1;

            const listaItems = tiendaData[categoriaSeleccionada];
            if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= listaItems.length) {
                return sock.sendMessage(chatId, { text: `⚠️ El número de ítem especificado no es válido en esta categoría.` }, { quoted: msg });
            }

            if (isNaN(cantidad) || cantidad <= 0) {
                return sock.sendMessage(chatId, { text: `⚠️ Debes indicar una cantidad válida mayor a 0.` }, { quoted: msg });
            }

            let itemSeleccionado = listaItems[itemIndex];
            let nombreItem = itemSeleccionado.nombre || itemSeleccionado.name || "Objeto";
            let precioUnitario = itemSeleccionado.precio || itemSeleccionado.price || 0;
            let costoTotal = precioUnitario * cantidad;

            if ((uGrupo.cartera || 0) < costoTotal) {
                return sock.sendMessage(chatId, { text: `⚠️ No tienes suficiente dinero. Necesitas *${formatoMoneda(costoTotal)}* en tu cartera.` }, { quoted: msg });
            }

            // Descontar dinero
            uGrupo.cartera -= costoTotal;
            if (!uGrupo.inventario) uGrupo.inventario = [];

            let mensajeExtra = "";

            // Lógica específica si se compran GUARDÍAS
            if (categoriaSeleccionada === "guardias") {
                let horasPorUnidad = itemSeleccionado.tiempoProteccion || 24;
                let totalHoras = horasPorUnidad * cantidad;
                let duracionMs = totalHoras * 60 * 60 * 1000;
                let ahora = Date.now();

                if (uGrupo.guardianHasta && uGrupo.guardianHasta > ahora) {
                    uGrupo.guardianHasta += duracionMs;
                } else {
                    uGrupo.guardianHasta = ahora + duracionMs;
                }
                mensajeExtra = `\n\n> ❖ ᴘʀᴏᴛᴇᴄᴄɪóɴ » _Guardián activado por +${totalHoras} horas en total_`;
            } else {
                // Para las demás categorías (armas, vehículos, libros, negocios, etc.), se guardan en el inventario acumulándose
                let existente = uGrupo.inventario.find(i => (i.nombre || i.name) === nombreItem);
                if (existente) {
                    existente.cantidad = (existente.cantidad || 1) + cantidad;
                } else {
                    uGrupo.inventario.push({ ...itemSeleccionado, cantidad });
                }
            }

            guardarDB();

            let txtCompra = `╭━━━ 🅲 ❮ ᴄᴏᴍᴘʀᴀ ᴇxɪ𝒕ᴏꜱᴀ ❯ 🅲 ━━━╮\n`;
            txtCompra += `┃\n`;
            txtCompra += `┃ ✰ ᴀʀᴛíᴄᴜʟᴏ » *${cantidad}x ${nombreItem}*\n`;
            txtCompra += `┃ ❖ ᴄᴀᴛᴇɢᴏʀíᴀ » *${categoriaSeleccionada.toUpperCase()}*\n`;
            txtCompra += `┃ 🪙 ᴄᴏꜱᴛᴏ ᴛᴏᴛᴀʟ » *${formatoMoneda(costoTotal)}*\n`;
            txtCompra += `┃\n`;
            txtCompra += `> ❀ ᴇꜱᴛᴀᴅᴏ » _Transacción registrada en el sistema_${mensajeExtra}\n`;
            txtCompra += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtCompra }, { quoted: msg });
        }

        return sock.sendMessage(chatId, { text: `⚠️ Uso incorrecto. Escribe \`${prefijoUsado}shop\` para ver las categorías.` }, { quoted: msg });
    }
};
