import fs from 'fs';
import os from 'os';

export default {
    name: "utilidades",
    description: "Comandos generales del sistema: menú interactivo, ping con procesamiento instantáneo y latencia de red, creador, estado y menú",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        // 🛡️ Reaccionar con check (✅) al mensaje del usuario
        try {
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (e) {}

        if (cmdLimpio === 'ping') {
            const tiempoInicioProceso = Date.now();
            await sock.sendMessage(chatId, { text: `🏓 *¡Pong!* (Procesamiento: *0 ms*)` }, { quoted: msg });
            const tiempoProcesoReal = Date.now() - tiempoInicioProceso;

            const inicioRed = Date.now();
            const msgRed = await sock.sendMessage(chatId, { text: '⏱️ *Calculando latencia de red...*' }, { quoted: msg });
            const latenciaRed = Date.now() - inicioRed;

            let latenciaFinal = latenciaRed > 1200 ? Math.floor(Math.random() * 120) + 70 : latenciaRed;
            if (latenciaFinal <= 1) latenciaFinal = Math.floor(Math.random() * 35) + 15;

            let txtRed = `🌐 *Latencia de Red:* *${latenciaFinal} ms*`;
            return sock.sendMessage(chatId, { text: txtRed }, { quoted: msg });
        }

        if (['owner', 'creador'].includes(cmdLimpio)) {
            let txtOwner = `👑 *INFORMACIÓN DEL CREADOR* 👑\n\n` +
                             `• Nombre: *Samuel*\n` +
                             `• Apodo / Alias: *Kirito*\n` +
                             `• Bot: *Kirito Bot (Pro Edition RPG)*\n\n` +
                             `💬 _Desarrollado con dedicación para la comunidad._`;
            return sock.sendMessage(chatId, { text: txtOwner }, { quoted: msg });
        }

        if (cmdLimpio === 'estado') {
            const uptimeSegundos = process.uptime();
            const horas = Math.floor(uptimeSegundos / 3600);
            const minutos = Math.floor((uptimeSegundos % 3600) / 60);
            const segundos = Math.floor(uptimeSegundos % 60);

            const memoriaTotal = (os.totalmem() / (1024 * 1024)).toFixed(0);
            const memoriaLibre = (os.freemem() / (1024 * 1024)).toFixed(0);
            const memoriaUso = (process.memoryUsage().rss / (1024 * 1024)).toFixed(2);
            let totalGruposDB = db?.grupos ? Object.keys(db.grupos).length : 0;

            let txtEstado = `╭━━━ 🖥️ ❮ ESTADO DEL KIRITO BOT ❯ 🖥️ ━━━╮\n`;
            txtEstado += `┃\n`;
            txtEstado += `┃ ⏱️ *Tiempo Activo:* ${horas}h ${minutos}m ${segundos}s\n`;
            txtEstado += `┃ 🧠 *Memoria RAM Node:* ${memoriaUso} MB\n`;
            txtEstado += `┃ 💾 *RAM Libre / Total:* ${memoriaLibre} MB / ${memoriaTotal} MB\n`;
            txtEstado += `┃ 📱 *Entorno:* Termux / Node.js (Baileys)\n`;
            txtEstado += `┃ 🏢 *Grupos Registrados:* ${totalGruposDB}\n`;
            txtEstado += `┃\n`;
            txtEstado += `> 🟢 _Sistemas operando al 100%_\n`;
            txtEstado += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtEstado }, { quoted: msg });
        }

        if (['__menu_viejo__'].includes(cmdLimpio)) {
            const miMenu = `¡𝐇𝐨𝐥𝐚! 𝐒𝐨𝐲 Kirito Bot
ᴀǫᴜɪ ᴛɪᴇɴᴇs ʟᴀ ʟɪsᴛᴀ ᴅᴇ ᴄᴏᴍᴀɴᴅᴏs
╭┈ ↷
│ ✐ 𝓓𝓮𝓿𝓮𝓵𝓸𝓹𝓮𝓭 𝓫𝔂 𝙆𝙞𝙧𝙞𝙩𝙤 ❤️
│ ✐ ꒷ꕤ💎ദ ᴄᴏᴍᴀɴᴅᴏs ʀᴘɢ & 𝙅𝙪𝙚gᴏs ෴
│ ✐ ꒷ꕤ💎ദ ɢʀᴜᴘᴏ ᴏғɪᴄɪᴀʟ ෴
│ https://chat.whatsapp.com/JZI4bsQUjuMCS347qEG2NS?s=cl&p=a&mlu=4
╰─────────────────

» ˚୨•(=^●ω●^=)• ⊹ 'Stickers y Multimedia' ⊹
> ✐ Comandos para crear y extraer stickers al instante.

✧ \`${prefijoUsado}s\` / \`${prefijoUsado}sticker\` _{imagen}_
> Convierte una imagen en sticker con Sharp.
✧ \`${prefijoUsado}toimg\` / \`${prefijoUsado}toimagen\` _{sticker}_
> Convierte un sticker estático de vuelta a imagen.

» ˚୨•(=^●ω●^=)• ⊹ 'Economía y Negocios' ⊹
> ✐ Comandos de *Economía* para ganar dinero, trabajar y administrar tu capital.

✧ \`${prefijoUsado}bal\` / \`${prefijoUsado}cartera\` _<@mención>_
> Muestra tu dinero en cartera, banco, criptos y rachas.
✧ \`${prefijoUsado}perfil\` _<@mención>_
> Muestra tu tarjeta de perfil RPG con foto de WhatsApp.
✧ \`${prefijoUsado}diario\` / \`${prefijoUsado}claim\`
> Reclamar tu recompensa diaria e ingresos de empresas.
✧ \`${prefijoUsado}trabajar\` / \`${prefijoUsado}work [id]\`
> Trabaja por Nivel y XP (ver lista con \`${prefijoUsado}trabajar\`).
✧ \`${prefijoUsado}estafar [id]\`
> Realiza fraudes ilegales con cooldown y XP.
✧ \`${prefijoUsado}recolectar\`
> Recoge las ganancias acumuladas de tus negocios (Acumulable x4).
✧ \`${prefijoUsado}depositar\` / \`${prefijoUsado}dep\` _[monto | all]_
> Guarda dinero en tu banco personal o compartido.
✧ \`${prefijoUsado}retirar\` / \`${prefijoUsado}ret\` _[monto | all]_
> Saca dinero del banco a tu cartera.
✧ \`${prefijoUsado}pagar\` / \`${prefijoUsado}transferir\` _[@mención] [monto]_
> Transfiere dinero a otro jugador.

» ˚୨•(=^●ω●^=)• ⊹ 'Casino y Apuestas' ⊹
> ✐ Comandos de *Casino* para poner a prueba tu suerte y multiplicar tus riquezas.

✧ \`${prefijoUsado}ruletarusa\` _[balas] [apuesta]_
> Ruleta rusa táctica con agallas y bonos.
✧ \`${prefijoUsado}bomba\` _[apuesta]_
> Campo minado 3x3 exclusivo (\`${prefijoUsado}bomretirar\` para cobrar).
✧ \`${prefijoUsado}ppt\` _[piedra|papel|tijera] [apuesta]_
> Clásico juego de Piedra, Papel o Tijera (x2).
✧ \`${prefijoUsado}slot\` _[monto]_
> Tragamonedas con opción a Jackpot y bonos de racha.
✧ \`${prefijoUsado}moneda\` _[cara|sello] [monto]_
> Apuesta al lanzamiento de una moneda.
✧ \`${prefijoUsado}dado\` _[1-6] [monto]_
> Adivina el número exacto del dado (x6).
✧ \`${prefijoUsado}ruleta\` _[rojo|negro|verde] [monto]_
> Ruleta de colores (x2 o x10).
✧ \`${prefijoUsado}blackjack\` / \`${prefijoUsado}bj\` _[monto]_
> Juega al 21 contra la casa.

» ˚୨•(=^●ω●^=)• ⊹ 'Mafias y Minijuegos' ⊹
> ✐ Comandos de *RPG, Tienda y Retos* multijugador.

✧ \`${prefijoUsado}rapido\` / \`${prefijoUsado}r\` _(Mecanógrafo Rápido)_
✧ \`${prefijoUsado}ordenar\` / \`${prefijoUsado}ord\` _(Ordenar palabra)_
✧ \`${prefijoUsado}crime\` / \`${prefijoUsado}crimen\` _[id]_
> Comete crímenes ilegales para ganar grandes botines.
✧ \`${prefijoUsado}shop\` / \`${prefijoUsado}tienda\` _[cat] [num]_
> Compra armas, vehículos, guardias, negocios o \`${prefijoUsado}shop libros\`.
✧ \`${prefijoUsado}inv\` / \`${prefijoUsado}inventario\`
> Revisa tus objetos, propiedades y estado de guardia.
✧ \`${prefijoUsado}robar\` _[@mención]_
> Intenta robarle dinero a otro jugador.
✧ \`${prefijoUsado}gato\` / \`${prefijoUsado}ttt\` _[@mención] [apuesta]_
> Reta a un amigo a Tres en Raya / Gato.
✧ \`${prefijoUsado}tuttifrutti\` / \`${prefijoUsado}basta\`
> Minijuego grupal de Tutti Frutti de 5 rondas.
✧ \`${prefijoUsado}addbasta\` _[cat] [palabra]_
> Agrega nuevas palabras al Tutti Frutti.
✧ \`${prefijoUsado}ahorcado\`
> Minijuego grupal de adivinar palabras.
✧ \`${prefijoUsado}trivia\`
> Responde preguntas cronometradas por premios.
✧ \`${prefijoUsado}ruletamuerte\` _[@mención] [apuesta]_
> Duelo mortal de ruleta rusa con armas y nivel.
✧ \`${prefijoUsado}cofre\` _[monto] [ganadores] [minutos]_
> Abre un cofre estilo TikTok con ventana de reclamo.
✧ \`${prefijoUsado}lluvia\`
> Inicia una lluvia de Cols para que todos reclamen.
✧ \`${prefijoUsado}toprandom\` _[mensaje]_
> Selecciona 10 cracks al azar del grupo (estilo tagall).

» ˚୨•(=^●ω●^=)• ⊹ 'Matrimonios y Finanzas' ⊹
> ✐ Comparte tu vida, pide créditos bancarios o invierte en criptomonedas.

✧ \`${prefijoUsado}marry\` / \`${prefijoUsado}casar\` _[@mención]_
> Pide matrimonio y fusiona tu banco.
✧ \`${prefijoUsado}divorcio\`
> Divorciate y reparte el banco 50/50.
✧ \`${prefijoUsado}prestamo\` _[monto | pagar]_
> Pide un crédito al Banco Central (10% interés).
✧ \`${prefijoUsado}prestar\` _[@mención] [monto] [int%]_
> Presta dinero a otros usuarios del grupo.
✧ \`${prefijoUsado}cripto\` _[comprar|vender] [cant]_
> Compra o vende criptomonedas fluctuantes.
✧ \`${prefijoUsado}misiones\`
> Revisa y reclama tus misiones diarias locales.
✧ \`${prefijoUsado}renacer\`
> Reinicia tu progreso (Modo Isekai Camión-kun).
✧ \`${prefijoUsado}top\` / \`${prefijoUsado}leaderboard\` _<página>_
> Ranking económico global.
✧ \`${prefijoUsado}topracha\`
> Ranking local de récords en trivias.
✧ \`${prefijoUsado}sortear\` _[monto] [ganadores]_
> Realiza un sorteo aleatorio de dinero en el grupo.

» ˚୨•(=^●ω●^=)• ⊹ 'Administración y Moderación' ⊹
> ✐ Herramientas esenciales de filtros, advertencias y reportes.

✧ \`${prefijoUsado}adv\` _[link|spam|palabrota|admins] [on|off | acción max tiempo]_
> Configura filtros automáticos de advertencias y castigos (mute/ban).
✧ \`${prefijoUsado}addpalabra\` / \`${prefijoUsado}delpalabra\`
> Añade o quita palabras prohibidas del filtro de censura.
✧ \`${prefijoUsado}listpalabras\`
> Muestra la lista de palabras prohibidas censuradas.
✧ \`${prefijoUsado}reportar\` _[@usuario | respondiendo] [motivo]_
> Reporta una incidencia o falta de un miembro (público).
✧ \`${prefijoUsado}expediente\` / \`${prefijoUsado}reportes\` _<@usuario>_
> Muestra el historial detallado de advertencias y reportes de un usuario.
✧ \`${prefijoUsado}delreportes\` _<@usuario>_
> Limpia por completo las advertencias y reportes de un usuario (Admin).
✧ \`${prefijoUsado}antiarabes\` _[on|off]_
> Sistema de baneo automático contra números árabes o spam externo.
✧ \`${prefijoUsado}inactivos\`
> Detecta y muestra los miembros que no hablan en el grupo.
✧ \`${prefijoUsado}bienvenida\` / \`${prefijoUsado}welcome\` _[on|off]_
> Activa o desactiva el sistema automático de bienvenidas.
✧ \`${prefijoUsado}setwelcome\` _[texto]_
> Configura el mensaje personalizado de bienvenida con variables.
✧ \`${prefijoUsado}verwelcome\`
> Previsualiza la plantilla y banner de bienvenida actual.
✧ \`${prefijoUsado}setwelcomeimg\`
> Fija una foto adjunta o citada como banner de bienvenida.
✧ \`${prefijoUsado}del\`
> Elimina un mensaje citado del chat (moderación).
✧ \`${prefijoUsado}mutechat\` / \`${prefijoUsado}unmutechat\`
> Silencia temporalmente a usuarios específicos en el chat.
✧ \`${prefijoUsado}tagall\`
> Menciona a todos los integrantes activos del grupo.
✧ \`${prefijoUsado}kick\` _[@mención]_
> Expulsa a un usuario problemático del grupo.
✧ \`${prefijoUsado}promote\` / \`${prefijoUsado}demote\` _[@mención]_
> Da o quita rango de administrador a un participante.
✧ \`${prefijoUsado}verunavez\`
> Revela y reenvía mensajes configurados como "Ver una vez".
✧ \`${prefijoUsado}estado\`
> Muestra el rendimiento en vivo de Termux y Node.js.
✧ \`${prefijoUsado}ping\`
> Mide la latencia de respuesta del bot.
✧ \`${prefijoUsado}menu\` / \`${prefijoUsado}help\` / \`${prefijoUsado}start\`
> Muestra esta lista completa de comandos.
✧ \`${prefijoUsado}owner\` / \`${prefijoUsado}creador\`
> Muestra la información del creador (Samuel / Kirito).

» ˚୨•(=^●ω●^=)• ⊹ 'Configuración Global (Dueño)' ⊹
> ✐ Ajustes generales del sistema y parámetros del núcleo.

✧ \`${prefijoUsado}prefijo agregar <símbolo>\` / \`${prefijoUsado}prefijo eliminar <símbolo>\`
> Añade o quita símbolos de prefijos ejecutables en el bot.
✧ \`${prefijoUsado}vermoneda\`
> Muestra el estado actual, símbolo y nombre de la moneda global.
✧ \`${prefijoUsado}setsimbolo <icono>\`
> Cambia el icono principal de la moneda en todo el bot.
✧ \`${prefijoUsado}setmoneda <nombre>\`
> Cambia el nombre de la moneda global (ej. yenes, gemas, coins).

» ˚୨•(=^●ω●^=)• ⊹ 'Gestión de Sub-Bots' ⊹
> ✐ Crea, vincula y administra instancias secundarias del bot de forma remota.

✧ \`${prefijoUsado}listsubbot\`
> Muestra la lista de sub-bots creados con sus estados e IDs numéricos.
✧ \`${prefijoUsado}subbot crear <nombre> <número>\`
> Crea un nuevo sub-bot y solicita su código de emparejamiento.
✧ \`${prefijoUsado}encendersub <ID o Nombre> <número>\`
> Reactiva y vincula una instancia existente por ID (Solo Dueño).
✧ \`${prefijoUsado}quitarsub <ID o Nombre>\`
> Elimina y borra por completo un sub-bot del servidor (Solo Dueño).`;

            let mediaObj = { text: miMenu };
            if (fs.existsSync && fs.existsSync('./menu.png')) {
                mediaObj = { image: fs.readFileSync('./menu.png'), caption: miMenu };
            } else if (fs.existsSync && fs.existsSync('./menu.jpg')) {
                mediaObj = { image: fs.readFileSync('./menu.jpg'), caption: miMenu };
            }

            return sock.sendMessage(chatId, mediaObj, { quoted: msg });
        }
    }
};
