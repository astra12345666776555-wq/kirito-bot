import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import pkg from 'node-webpmux';
const { Image } = pkg;

export default {
    name: "stickers",
    description: "Comandos para crear stickers con Sharp y metadatos EXIF personalizados estilo Pro.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        if (["s", "sticker", "stiker"].includes(cmdLimpio)) {
            let messageContent = msg.message;
            let quotedMessage = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage;

            let targetMessage = null;
            let mediaType = null;

            if (messageContent?.imageMessage) {
                targetMessage = messageContent.imageMessage;
                mediaType = 'image';
            } else if (quotedMessage?.imageMessage) {
                targetMessage = quotedMessage.imageMessage;
                mediaType = 'image';
            }

            if (!targetMessage) {
                return sock.sendMessage(chatId, { 
                    text: `⚠️ *Uso incorrecto*\n\nEnvía una imagen con el texto \`${prefijoUsado}s\` o responde a una foto con \`${prefijoUsado}s\` para crear tu sticker.` 
                }, { quoted: msg });
            }

            try {
                await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

                let stream = await downloadContentFromMessage(targetMessage, mediaType);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                // 1. Generar la imagen WebP optimizada con Sharp
                let webpBuffer = await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp({ quality: 80 })
                    .toBuffer();

                // 2. Cargar el WebP en node-webpmux y configurar el diseño EXIF estilo Pro
                const img = new Image();
                await img.load(webpBuffer);

                const groupLink = "https://chat.whatsapp.com/BYoDiifN4Cq6DJYcGqtflZ";

                const jsonExif = {
                    "sticker-pack-id": "https://github.com/adiwajshing/Baileys",
                    "sticker-pack-name": `⚔️ Kirito Bot\n↳${groupLink}`,
                    "sticker-pack-publisher": "👑 Kirito (Samuel)\n👹 Info:\n↳Grupo Oficial · 👑 Bot:\n↳@Kirito Bot",
                    "android-app-store-link": groupLink,
                    "ios-app-store-link": groupLink,
                    "emojis": ["🤖", "⚔️", "💎"]
                };

                const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
                const exifData = Buffer.from(JSON.stringify(jsonExif), "utf-8");
                const exif = Buffer.concat([exifAttr, exifData]);
                exif.writeUIntLE(exifData.length, 14, 4);

                img.exif = exif;
                
                // 3. Guardar como búfer en memoria de forma segura
                let finalBuffer = await img.save(null, { type: 'buffer' });

                // Enviar el sticker con la descripción y el diseño personalizados
                await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

            } catch (error) {
                console.error("Error al crear sticker con estilo:", error);
                return sock.sendMessage(chatId, { text: "❌ Ocurrió un error al procesar el sticker con metadatos." }, { quoted: msg });
            }
        }
    }
};
