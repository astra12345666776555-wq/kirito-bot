import fs from "fs";
import path from "path";

/* ════════════════════════════════════════════════════════════════
   MENÚ · Kirito Bot
   Formato del menú de referencia: categorías, comandos con alias y descripción.
   Para agregar un comando nuevo, añade una línea en CATEGORIAS (abajo).
   ════════════════════════════════════════════════════════════════ */

const NOMBRE_BOT = "Kirito Bot";
const LINK_GRUPO = "https://chat.whatsapp.com/H4z3y300pZWKpqcrgjH609?s=cl&p=a&mlu=4&iam=2";

// Imagen del menú (se usa la primera que exista)
const IMAGENES_MENU = [
    path.resolve("media", "menu.jpg"),
    path.resolve("menu.jpg"),
    path.resolve("menu.png")
];

// cmds: [comando, ...alias]  ·  args: texto de uso (opcional)  ·  desc: descripción
const CATEGORIAS = [
    {
        clave: "economia", alias: ["economía", "eco", "dinero"],
        titulo: "Economía",
        intro: "Comandos de *Economía* para ganar dinero, trabajar y administrar tu capital.",
        comandos: [
            { cmds: ["bal", "balance", "cartera", "dinero"], args: "<@mención>", desc: "Ver tu dinero, nivel, XP y protección." },
            { cmds: ["diario", "daily"], desc: "Reclamar tu recompensa diaria." },
            { cmds: ["trabajar", "work", "chamba", "empleo"], args: "<id>", desc: "Trabajar por dinero y XP (ver lista con el comando solo)." },
            { cmds: ["crime", "crimen"], args: "<id>", desc: "Cometer crímenes con bono por armas y vehículos." },
            { cmds: ["estafar"], args: "<id>", desc: "Realizar estafas con cooldown de 10 minutos." },
            { cmds: ["robar", "steal"], args: "[@mención]", desc: "Intentar robarle dinero a otro jugador." },
            { cmds: ["recolectar", "recoger"], desc: "Recoger las ganancias de tus negocios." },
            { cmds: ["dep", "depositar"], args: "[cantidad | all]", desc: "Guardar dinero en tu banco." },
            { cmds: ["ret", "retirar"], args: "[cantidad | all]", desc: "Sacar dinero del banco a tu cartera." },
            { cmds: ["cripto"], args: "[comprar | vender] [cantidad]", desc: "Comprar o vender KiritoCoin (KRT)." },
            { cmds: ["prestamo"], args: "[monto] [días] | pagar", desc: "Pedir un crédito al Banco Central o pagarlo." },
            { cmds: ["prestar"], args: "[@mención] [monto] [int%]", desc: "Prestar dinero a otro usuario." },
            { cmds: ["shop", "tienda"], args: "[categoría] [num] [cantidad]", desc: "Comprar armas, vehículos, guardias, negocios y libros." },
            { cmds: ["inv", "inventario"], args: "<@mención>", desc: "Ver tus objetos, negocios y estado civil." },
            { cmds: ["top", "baltop"], desc: "Ranking de los más ricos del grupo." },
            { cmds: ["misiones", "quests"], desc: "Ver tus misiones diarias." },
            { cmds: ["cofre"], args: "[monto] [ganadores]", desc: "Abrir un cofre de recompensa para el grupo." },
            { cmds: ["lluvia"], args: "[monto]", desc: "Lanzar una lluvia de dinero para el grupo." },
            { cmds: ["agarrar"], desc: "Reclamar un cofre o una lluvia activa." },
            { cmds: ["sortear"], args: "[monto] [ganadores]", desc: "Sortear dinero entre miembros del grupo." }
        ]
    },
    {
        clave: "casino", alias: ["apuestas"],
        titulo: "Casino",
        intro: "Comandos de *Casino* para poner a prueba tu suerte.",
        comandos: [
            { cmds: ["slot", "tragamonedas"], args: "[monto]", desc: "Tragamonedas con premio gordo." },
            { cmds: ["moneda", "carasello", "cs"], args: "[cara | sello] [monto]", desc: "Apostar a cara o sello." },
            { cmds: ["dado", "dice"], args: "[1-6] [monto]", desc: "Adivinar el número del dado." },
            { cmds: ["ruleta", "roulette"], args: "[rojo | negro | verde] [monto]", desc: "Apostar a un color de la ruleta." },
            { cmds: ["ruletarusa", "rrsa"], args: "[balas] [apuesta]", desc: "Ruleta rusa: usa disparar / retirarruleta para jugar." },
            { cmds: ["ppt"], args: "[piedra | papel | tijera] [apuesta]", desc: "Piedra, papel o tijera contra el bot." },
            { cmds: ["ruletamuerte"], args: "[@mención] [apuesta]", desc: "Duelo mortal contra otro jugador." }
        ]
    },
    {
        clave: "juegos", alias: ["minijuegos", "retos"],
        titulo: "Juegos",
        intro: "Comandos de *Juegos* y retos para todo el grupo.",
        comandos: [
            { cmds: ["gato", "ttt", "tresenraya"], args: "[@mención] [apuesta]", desc: "Reta a alguien a Tres en Raya (acepta con aceptar)." },
            { cmds: ["tuttifruti", "basta"], desc: "Tutti Frutti grupal (responde con .t <palabra>)." },
            { cmds: ["addbasta"], args: "[categoría] [palabra]", desc: "Agregar una palabra al Tutti Frutti." },
            { cmds: ["ahorcado", "hangman"], desc: "Ahorcado grupal (adivina con .a <letra | palabra>)." },
            { cmds: ["trivia"], args: "<respuesta>", desc: "Responder preguntas por premios." },
            { cmds: ["rapido", "r"], args: "<frase>", desc: "Desafío de mecanografía rápida." },
            { cmds: ["ordenar", "ord"], args: "<palabra>", desc: "Ordenar las letras de una palabra." },
            { cmds: ["toprandom"], args: "<mensaje>", desc: "Top aleatorio de 10 miembros del grupo." },
            { cmds: ["topracha"], desc: "Ranking de rachas de trivia." }
        ]
    },
    {
        clave: "gacha", alias: ["personajes", "waifus"],
        titulo: "Gacha",
        intro: "Comandos de *Gacha* para reclamar y intercambiar personajes.",
        comandos: [
            { cmds: ["rollwaifu", "rw", "roll"], desc: "Tirar un personaje aleatorio." },
            { cmds: ["claim", "c", "reclamar"], desc: "Reclamar el personaje que salió." },
            { cmds: ["harem", "waifus", "claims", "coleccion"], args: "<@mención> <página>", desc: "Ver los personajes reclamados." },
            { cmds: ["charinfo", "winfo", "waifuinfo"], args: "[nombre]", desc: "Ver información de un personaje." },
            { cmds: ["charimage", "waifuimage", "cimage", "wimage"], args: "[nombre]", desc: "Ver la imagen de un personaje." },
            { cmds: ["sell", "vender"], args: "[precio] [nombre]", desc: "Poner un personaje a la venta." },
            { cmds: ["haremshop", "tiendawaifus", "wshop"], args: "<página>", desc: "Ver los personajes en venta." },
            { cmds: ["buycharacter", "buychar", "buyc"], args: "[nombre]", desc: "Comprar un personaje en venta." },
            { cmds: ["removesale", "removerventa"], args: "[nombre]", desc: "Quitar un personaje de la venta." },
            { cmds: ["givechar", "givewaifu", "regalar"], args: "[@mención] [nombre]", desc: "Regalar un personaje." },
            { cmds: ["giveallharem"], args: "[@mención] confirmar", desc: "Regalar todos tus personajes." },
            { cmds: ["deletewaifu", "delwaifu", "delchar"], args: "[nombre]", desc: "Liberar un personaje reclamado." },
            { cmds: ["setfavourite", "setfav"], args: "[nombre]", desc: "Elegir tu personaje favorito." },
            { cmds: ["delfavourite", "delfav"], desc: "Quitar tu favorito." },
            { cmds: ["favoritetop", "favtop"], desc: "Top de personajes favoritos." },
            { cmds: ["waifusboard", "waifustop", "topwaifus", "wtop"], args: "<página>", desc: "Top de personajes con mayor valor." },
            { cmds: ["gachainfo", "ginfo", "infogacha"], desc: "Ver tu información de gacha." },
            { cmds: ["vote", "votar"], args: "[nombre]", desc: "Votar por un personaje para subir su valor." },
            { cmds: ["serielist", "slist", "animelist"], args: "<página>", desc: "Listar las series disponibles." },
            { cmds: ["serieinfo", "ainfo", "animeinfo"], args: "[nombre]", desc: "Ver los personajes de una serie." },
            { cmds: ["setclaimmsg", "setclaim"], args: "[texto]", desc: "Personalizar tu mensaje al reclamar ({usuario}, {personaje})." },
            { cmds: ["delclaimmsg"], desc: "Restablecer el mensaje al reclamar." },
            { cmds: ["cooldowns", "cd", "tiempos"], args: "<@mención>", desc: "Ver tus cooldowns (gacha y economía)." },
            { cmds: ["setcd"], args: "[roll | claim | voto] [tiempo]", desc: "Ver o cambiar los tiempos del gacha (cambiar: solo dueño). Ej: 10m, 30s, 1h30m." },
            { cmds: ["cdreset"], args: "<@mención | all>", desc: "Reiniciar los cooldowns del gacha (solo dueño)." },
            { cmds: ["addchar"], args: "[nombre | serie | valor | género | enlace]", desc: "Agregar un personaje (solo dueño). Puedes adjuntar una foto." },
            { cmds: ["setcharimg"], args: "[nombre] <enlace>", desc: "Cambiar la imagen de un personaje con una foto o un enlace (solo dueño)." }
        ]
    },
    {
        clave: "perfil", alias: ["perfiles", "social"],
        titulo: "Perfiles",
        intro: "Comandos de *Perfil* para ver y configurar tu perfil.",
        comandos: [
            { cmds: ["perfil"], args: "<@mención>", desc: "Ver tu perfil o el de otro usuario." },
            { cmds: ["user", "alias", "apodo"], args: "[nombre]", desc: "Cambiar tu nombre de perfil." },
            { cmds: ["setgenero"], args: "[texto]", desc: "Establecer tu género." },
            { cmds: ["setedad"], args: "[número]", desc: "Establecer tu edad." },
            { cmds: ["setcumple"], args: "[fecha]", desc: "Establecer tu cumpleaños." },
            { cmds: ["setpais"], args: "[país]", desc: "Establecer tu país." },
            { cmds: ["setpasatiempo"], args: "[hobby]", desc: "Establecer tu pasatiempo." },
            { cmds: ["setperfil"], args: "{imagen}", desc: "Poner una foto a tu perfil." },
            { cmds: ["casar", "marry"], args: "[@mención]", desc: "Proponer matrimonio." },
            { cmds: ["aceptarboda"], desc: "Aceptar una propuesta de matrimonio." },
            { cmds: ["divorcio"], desc: "Divorciarte (se reparte 50/50)." }
        ]
    },
    {
        clave: "ia", alias: ["ai", "inteligencia"],
        titulo: "Inteligencia Artificial",
        intro: "Pregúntale lo que quieras a la *IA* del bot.",
        comandos: [
            { cmds: ["ia", "ai", "gemini"], args: "[pregunta]", desc: "Responder una pregunta (también respondiendo a un mensaje)." }
        ]
    },
    {
        clave: "busqueda", alias: ["buscar", "search", "buscador"],
        titulo: "Búsqueda",
        intro: "Busca en la web, YouTube, TikTok y más, cada una con su propio formato.",
        comandos: [
            { cmds: ["search", "buscar"], args: "[google | youtube | tiktok | wiki | anime | personaje | github] [lo que buscas]", desc: "Sin plataforma, busca en la web. Ej: .search youtube doma" }
        ]
    },
    {
        clave: "musica", alias: ["música", "audio", "play"],
        titulo: "Música",
        intro: "Descarga el audio de cualquier canción o video.",
        comandos: [
            { cmds: ["play", "audio", "song", "playaudio", "ytaudio", "yt"], args: "[nombre | enlace]", desc: "Enviar el audio de una canción (las repetidas llegan al instante)." }
        ]
    },
    {
        clave: "utilidades", alias: ["util", "utiles", "utils"],
        titulo: "Utilidades",
        intro: "Comandos de *Utilidades* para el día a día del bot.",
        comandos: [
            { cmds: ["menu", "help", "commands", "comandos", "start"], args: "<categoría>", desc: "Ver el menú de comandos." },
            { cmds: ["ping"], desc: "Medir la velocidad de respuesta del bot." },
            { cmds: ["estado"], desc: "Ver el estado del bot." },
            { cmds: ["owner", "creador"], desc: "Información del creador." }
        ]
    },
    {
        clave: "admin", alias: ["administracion", "administración", "grupo"],
        titulo: "Administración",
        intro: "Comandos para administradores de grupos.",
        comandos: [
            { cmds: ["kick", "ban", "expulsar"], args: "[@mención | respuesta] [motivo]", desc: "Expulsar a un usuario del grupo." },
            { cmds: ["abrir", "open"], desc: "Abrir el grupo (todos pueden escribir)." },
            { cmds: ["cerrar", "close"], desc: "Cerrar el grupo (solo administradores)." },
            { cmds: ["mute", "silenciar"], args: "[@mención] [minutos]", desc: "Silenciar a un usuario (se borran sus mensajes)." },
            { cmds: ["unmute", "desmutear"], args: "[@mención]", desc: "Quitar el silencio a un usuario." },
            { cmds: ["del", "delete"], args: "{mensaje} | <cantidad>", desc: "Eliminar mensajes." },
            { cmds: ["temporales"], args: "[24h | 7d | 90d | off]", desc: "Configurar los mensajes temporales." }
        ]
    },
    {
        clave: "subbots", alias: ["subbot", "sub-bots", "sub"],
        titulo: "Sub-bots",
        intro: "Crea y administra instancias secundarias del bot.",
        comandos: [
            { cmds: ["listsubbot"], desc: "Ver los sub-bots creados con su estado." },
            { cmds: ["subbot crear"], args: "[nombre] [número]", desc: "Crear un sub-bot y recibir su código de vinculación." },
            { cmds: ["encendersub"], args: "[ID | nombre] [número]", desc: "Reactivar un sub-bot (solo dueño)." },
            { cmds: ["quitarsub"], args: "[ID]", desc: "Eliminar un sub-bot (solo dueño). Usa el número de la lista." }
        ]
    }
];

// ── Detección automática: plugins que no están en la lista de arriba ──
// Se muestran en la categoría "Otros" para que ningún comando quede fuera del menú.
// Para ocultar un plugin del menú, agrega aquí el nombre de su archivo.
const OCULTAR_PLUGINS = new Set(["blackjack.js", "bomba.js", "verunavez.js"]); // blackjack y bomba aún no tienen juego real
const IDS_CMD = "(?:[A-Za-z_]*(?:cmd|comando|command)[A-Za-z_]*)";
const SUFIJOS = "(?:\\s*\\.\\s*(?:toLowerCase|trim)\\(\\))*";

function comandosDePlugin(codigo) {
    const salida = new Set();
    const agregar = (w) => { w = String(w).toLowerCase(); if (/^[a-zñáéíóú0-9]{1,24}$/.test(w)) salida.add(w); };
    for (const m of codigo.matchAll(new RegExp(`\\[([^\\]]{1,400})\\]\\s*\\.includes\\(\\s*${IDS_CMD}${SUFIJOS}\\s*\\)`, "g"))) {
        for (const w of m[1].matchAll(/['"`]([^'"`]+)['"`]/g)) agregar(w[1]);
    }
    for (const m of codigo.matchAll(new RegExp(`${IDS_CMD}${SUFIJOS}\\s*(?:===|==|!==|!=)\\s*['"\`]([^'"\`]+)['"\`]`, "g"))) agregar(m[1]);
    for (const m of codigo.matchAll(/case\s+['"`]([^'"`]+)['"`]\s*:/g)) agregar(m[1]);
    return [...salida];
}

let cacheOtros = { ts: 0, lista: [] };
function descubrirOtros() {
    if (Date.now() - cacheOtros.ts < 60_000) return cacheOtros.lista;
    const lista = [];
    try {
        const conocidos = new Set();
        for (const c of CATEGORIAS) for (const k of c.comandos) for (const x of k.cmds) conocidos.add(x.split(" ")[0].toLowerCase());
        const dir = path.resolve("plugins");
        for (const archivo of fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort()) {
            if (OCULTAR_PLUGINS.has(archivo)) continue;
            const codigo = fs.readFileSync(path.join(dir, archivo), "utf8");
            const cmds = comandosDePlugin(codigo);
            if (cmds.length === 0 || cmds.some(c => conocidos.has(c))) continue;
            const desc = codigo.match(/description:\s*['"`]([^'"`]{3,120})['"`]/)?.[1] || `Comando del plugin ${archivo}.`;
            lista.push({ cmds: cmds.slice(0, 6), desc });
        }
    } catch (e) {
        console.error("[MENU] No se pudo detectar plugins extra:", e.message);
    }
    cacheOtros = { ts: Date.now(), lista };
    return lista;
}

function categoriasCompletas() {
    const otros = descubrirOtros();
    if (otros.length === 0) return CATEGORIAS;
    return [...CATEGORIAS, {
        clave: "otros", alias: ["extras", "varios"],
        titulo: "Otros",
        intro: "Comandos de otros plugins, detectados automáticamente.",
        comandos: otros
    }];
}

const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function encabezado() {
    return `¡𝐇𝐨𝐥𝐚! 𝐒𝐨𝐲 ${NOMBRE_BOT}\n` +
        `ᴀǫᴜɪ ᴛɪᴇɴᴇs ʟᴀ ʟɪsᴛᴀ ᴅᴇ ᴄᴏᴍᴀɴᴅᴏs\n` +
        `╭┈ ↷\n` +
        `│ ✐ 𝓓𝓮𝓿𝓮𝓵𝓸𝓹𝓮𝓭 𝓫𝔂 𝙆𝙞𝙧𝙞𝙩𝙤 ❤️\n` +
        `│ ✐ ꒷ꕤ💎ദ ᴄᴏᴍᴀɴᴅᴏs ෴\n` +
        `│ ✐ ꒷ꕤ💎ദ ɢʀᴜᴘᴏ ᴏғɪᴄɪᴀʟ ෴\n` +
        `│ ${LINK_GRUPO}\n` +
        `╰─────────────────`;
}

function textoCategoria(cat, P) {
    let t = `» ˚୨•(=^●ω●^=)• ⊹ \`${cat.titulo}\` ⊹\n> ✐ ${cat.intro}\n\n`;
    for (const c of cat.comandos) {
        const cmds = c.cmds.map(x => `\`${P}${x}\``).join(" ");
        t += `✧ ${cmds}${c.args ? ` _${c.args}_` : ""}\n> ${c.desc}\n`;
    }
    return t;
}

function imagenMenu() {
    for (const ruta of IMAGENES_MENU) {
        try { if (fs.existsSync(ruta)) return fs.readFileSync(ruta); } catch { /* sigue con la siguiente */ }
    }
    return null;
}

export default {
    name: "menu",
    description: "Menú de comandos por categorías con imagen por defecto",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado) => {
        const cmd = norm(comando);
        if (!["menu", "help", "commands", "comandos", "start"].includes(cmd)) return;

        const P = prefijoUsado || ".";
        const pedida = norm(args[0]);

        try {
            let texto;
            if (pedida) {
                const cat = categoriasCompletas().find(c => c.clave === pedida || c.alias.map(norm).includes(pedida));
                if (!cat) {
                    const claves = categoriasCompletas().map(c => `\`${c.clave}\``).join(", ");
                    return sock.sendMessage(chatId, { text: `⚠️ No existe esa categoría.\nCategorías: ${claves}\nEjemplo: \`${P}menu gacha\`` }, { quoted: msg });
                }
                texto = textoCategoria(cat, P).trimEnd();
            } else {
                // Menú completo: TODO en un solo mensaje
                const todas = categoriasCompletas();
                const claves = todas.map(c => `\`${c.clave}\``).join(" · ");
                texto = todas.map(c => textoCategoria(c, P)).join("\n")
                    + `\n> 💡 Ver una sola categoría: \`${P}menu <categoría>\`\n> ${claves}`;
            }

            // 1) Imagen por defecto con el encabezado
            const img = imagenMenu();
            if (img) {
                try {
                    await sock.sendMessage(chatId, { image: img, caption: encabezado() }, { quoted: msg });
                } catch (e) {
                    console.error("[MENU] No se pudo enviar la imagen:", e.message);
                    await sock.sendMessage(chatId, { text: encabezado() }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(chatId, { text: encabezado() }, { quoted: msg });
            }

            // 2) El menú (un solo mensaje)
            await sock.sendMessage(chatId, { text: texto });
        } catch (e) {
            console.error("❌ Error en plugin menu:", e);
        }
    }
};
