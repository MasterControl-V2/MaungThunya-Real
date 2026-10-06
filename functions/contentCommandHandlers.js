// contentCommandHandlers.js
// This file contains functions that handle commands related to content management (set, get, delete key/file/photo).

import { sendMessage, sendDocument, sendPhoto } from './telegramApiHelpers';
import { setContentData, getContentData, deleteContentData } from './contentKvInteractions';
import { isUserAdmin } from './userManagementFunctions'; // Import isUserAdmin

/**
 * Handles /setkey, /setfile, /setphoto commands.
 * This function is modified to correctly parse arguments using '|' as a delimiter
 * for title and description, and to get the content/file_id from the replied message.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} type - 'key', 'file', or 'photo'.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleSetContentCommand(message, token, env, type, botKeyValue) { 
    const chatId = message.chat.id;
    const fromUser = message.from;
    const commandText = message.text;
    const command = commandText.split(' ')[0].toLowerCase(); // e.g., "/setkey"

    console.log(`[handleSetContentCommand] Received ${command} from user ${fromUser.id}. Type: ${type}`);
    console.log(`[handleSetContentCommand] Full command text: "${commandText}"`);

    // Check if the user is a bot admin (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        console.warn(`[handleSetContentCommand] Unauthorized access attempt by user ${fromUser.id}.`);
        await sendMessage(token, chatId, "🚫 ဤ command ကို အသုံးပြုရန် ခွင့်ပြုချက်မရှိပါ။", 'HTML', null, botKeyValue);
        return;
    }

    let keyword, title = null, description = null, file_id = null;

    // Ensure it's a reply message for all content types
    if (!message.reply_to_message) {
        await sendMessage(token, chatId, `Please reply to a ${type === 'key' ? 'text message' : type} with <code>/${command.substring(1)} &lt;keyword&gt;[|title][|description]</code>.`, 'HTML', null, botKeyValue);
        return;
    }

    // Extract the arguments string after the command (e.g., "keyword|title|description")
    const rawArgs = commandText.substring(command.length).trim();

    // If no arguments are provided after the command (e.g., just "/setkey" with a reply)
    if (!rawArgs) {
         await sendMessage(token, chatId, `Please provide a keyword. Usage: <code>/${command.substring(1)} &lt;keyword&gt;[|title][|description]</code>.`, 'HTML', null, botKeyValue);
         return;
    }

    // Split arguments by '|' to get keyword, title, and description
    const argParts = rawArgs.split('|').map(p => p.trim());
    keyword = argParts[0].toLowerCase(); // The first part is always the keyword

    // Set file_id based on the type and content of the replied message
    if (type === 'key') {
        if (message.reply_to_message.text) {
            file_id = message.reply_to_message.text;
        } else {
            await sendMessage(token, chatId, "Please reply to a text message to set a key content.", 'HTML', null, botKeyValue);
            return;
        }
        // For 'key' type, the second argPart is title, third is description
        if (argParts.length > 1) title = argParts[1];
        if (argParts.length > 2) description = argParts[2];

    } else if (type === 'file') {
        if (message.reply_to_message.document) {
            file_id = message.reply_to_message.document.file_id;
        } else {
            await sendMessage(token, chatId, "Please reply to a document to set a file.", 'HTML', null, botKeyValue);
            return;
        }
        // For 'file'/'photo' types, the second argPart is title, third is description
        if (argParts.length > 1) title = argParts[1];
        if (argParts.length > 2) description = argParts[2];

    } else if (type === 'photo') {
        if (message.reply_to_message.photo && message.reply_to_message.photo.length > 0) {
            // Get the largest photo size (last element in the array)
            file_id = message.reply_to_message.photo.pop().file_id;
        } else {
            await sendMessage(token, chatId, "Please reply to a photo to set a photo.", 'HTML', null, botKeyValue);
            return;
        }
        // For 'file'/'photo' types, the second argPart is title, third is description
        if (argParts.length > 1) title = argParts[1];
        if (argParts.length > 2) description = argParts[2];
    }

    // If file_id could not be determined from the replied message, send error
    if (!file_id) {
         await sendMessage(token, chatId, `Could not retrieve content from the replied message for ${type} type.`, 'HTML', null, botKeyValue);
         return;
    }

    const dataToStore = { type: type, title: title, description: description, file_id: file_id };
    const success = await setContentData(type, keyword, dataToStore, env);

    if (success) {
        await sendMessage(token, chatId, `✅ ${type} '${keyword}' ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`, 'HTML', null, botKeyValue);
        console.log(`[handleSetContentCommand] Stored ${type} '${keyword}'.`);
    } else {
        await sendMessage(token, chatId, `❌ ${type} '${keyword}' ကို သိမ်းဆည်း၍ မရပါ။`, 'HTML', null, botKeyValue);
        console.error(`[handleSetContentCommand] Failed to store ${type} '${keyword}'.`);
    }
}

/**
 * Handles /key, /file, /photo, /getcombined, /gc commands.
 * This function is modified to correctly display title and description for 'key' type,
 * and to include the "Copy Code" button for key content in a code block.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} type - 'key', 'file', 'photo', or 'combined'.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleGetContentCommand(message, token, env, type, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const commandText = message.text;
    const args = commandText.split(' ');
    const command = args[0].toLowerCase();
    const keyword = args[1] ? args[1].toLowerCase() : null;

    console.log(`[handleGetContentCommand] Received ${command} from user ${fromUser.id}. Type: ${type}, Keyword: ${keyword}`);

    // Check if the user is a bot admin (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        console.warn(`[handleGetContentCommand] Unauthorized access attempt by user ${fromUser.id}.`);
        await sendMessage(token, chatId, "🚫 ဤ command ကို အသုံးပြုရန် ခွင့်ပြုချက်မရှိပါ။", 'HTML', null, botKeyValue);
        return;
    }

    if (!keyword) {
        await sendMessage(token, chatId, `Please provide a keyword. Usage: <code>/${command.substring(1)} &lt;keyword&gt;</code>.`, 'HTML', null, botKeyValue);
        return;
    }

    // If the command is /getcombined or /gc, call the specific combined handler
    if (type === 'combined') {
        await handleGetCombinedCommand(message, token, env, botKeyValue);
        return;
    }

    const contentData = await getContentData(type, keyword, env);

    if (contentData) {
        let displayContent = '';
        let reply_markup = null; // Initialize reply_markup (will remain null for key type)

        if (contentData.title) {
            displayContent += `<b>${contentData.title}</b>\n`;
        }
        if (contentData.description) {
            // Add a newline only if there was a title, otherwise directly append
            displayContent += `${contentData.title ? '\n' : ''}<i>${contentData.description}</i>\n`; 
        }
        
        if (type === 'key') {
            // For 'key' type, file_id holds the text content itself
            const fullTextContent = contentData.file_id; 

            // Wrap the actual key content in a Telegram code block
            // Telegram automatically adds a "Copy Code" button for <pre><code> blocks.
            // We removed our custom button to avoid duplicates.
            displayContent += `<pre><code language="text">${fullTextContent}</code></pre>`; 
            
            await sendMessage(token, chatId, displayContent, 'HTML', reply_markup, botKeyValue); // reply_markup is null here
            console.log(`[handleGetContentCommand] Sent key content for keyword '${keyword}'.`);
        } else if (type === 'file') {
            await sendDocument(token, chatId, contentData.file_id, displayContent, null, botKeyValue);
            console.log(`[handleGetContentCommand] Sent file for keyword '${keyword}'.`);
        } else if (type === 'photo') {
            await sendPhoto(token, chatId, contentData.file_id, displayContent, null, botKeyValue);
            console.log(`[handleGetContentCommand] Sent photo for keyword '${keyword}'.`);
        }
    } else {
        await sendMessage(token, chatId, `❌ Keyword '${keyword}' နဲ့ ပတ်သက်တဲ့ ${type} တစ်ခုမှ ရှာမတွေ့ပါဘူးရှင့်။`, 'HTML', null, botKeyValue);
        console.log(`[handleGetContentCommand] No ${type} found for keyword '${keyword}'.`);
    }
}

/**
 * Handles /deletekey, /deletefile, /deletephoto commands.
 * This function does not require modification.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} type - 'key', 'file', or 'photo'.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleDeleteContentCommand(message, token, env, type, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const commandText = message.text;
    const args = commandText.split(' ');
    const command = args[0].toLowerCase();
    const keyword = args[1] ? args[1].toLowerCase() : null;

    console.log(`[handleDeleteContentCommand] Received ${command} from user ${fromUser.id}. Type: ${type}, Keyword: ${keyword}`);

    // Check if the user is a bot admin (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        console.warn(`[handleDeleteContentCommand] Unauthorized access attempt by user ${fromUser.id}.`);
        await sendMessage(token, chatId, "🚫 ဤ command ကို အသုံးပြုရန် ခွင့်ပြုချက်မရှိပါ။", 'HTML', null, botKeyValue);
        return;
    }

    if (!keyword) {
        await sendMessage(token, chatId, `Please provide a keyword. Usage: <code>/${command.substring(1)} &lt;keyword&gt;</code>.`, 'HTML', null, botKeyValue);
        return;
    }

    const success = await deleteContentData(type, keyword, env);

    if (success) {
        await sendMessage(token, chatId, `✅ ${type} '${keyword}' ကို အောင်မြင်စွာ ဖျက်လိုက်ပါပြီ။`, 'HTML', null, botKeyValue);
        console.log(`[handleDeleteContentCommand] Deleted ${type} '${keyword}'.`);
    } else {
        await sendMessage(token, chatId, `❌ ${type} '${keyword}' ကို ဖျက်၍ မရပါ။ ရှာမတွေ့ခြင်း သို့မဟုတ် အမှားအယွင်း ဖြစ်ခြင်း။`, 'HTML', null, botKeyValue);
        console.error(`[handleDeleteContentCommand] Failed to delete ${type} '${keyword}'.`);
    }
}

/**
 * Handles /getcombined or /gc command to retrieve both photo and file for a keyword.
 * This function is modified to correctly display title and description for key content
 * when retrieved via /getcombined, within a code block, and to fix duplicate button/line issues.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleGetCombinedCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const commandText = message.text;
    const args = commandText.split(' ');
    const keyword = args[1] ? args[1].toLowerCase() : null;

    console.log(`[handleGetCombinedCommand] Received /getcombined or /gc from user ${fromUser.id}. Keyword: ${keyword}`);

    // Check if the user is a bot admin (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        console.warn(`[handleGetCombinedCommand] Unauthorized access attempt by user ${fromUser.id}.`);
        await sendMessage(token, chatId, "🚫 ဤ command ကို အသုံးပြုရန် ခွင့်ပြုချက်မရှိပါ။", 'HTML', null, botKeyValue);
        return;
    }

    if (!keyword) {
        await sendMessage(token, chatId, "Please provide a keyword. Usage: <code>/getcombined &lt;keyword&gt;</code> or <code>/gc &lt;keyword&gt;</code>.", 'HTML', null, botKeyValue);
        return;
    }

    const photoData = await getContentData('photo', keyword, env);
    const fileData = await getContentData('file', keyword, env);
    const keyData = await getContentData('key', keyword, env); // Also check for key content with the same keyword

    let foundContent = false;

    // Send photo if found
    if (photoData && photoData.type === 'photo' && photoData.file_id) {
        let photoCaption = '';
        if (photoData.title) {
            photoCaption += `<b>${photoData.title}</b>\n`;
        }
        if (photoData.description) {
            photoCaption += `${photoData.title ? '\n' : ''}<i>${photoData.description}</i>\n`;
        }
        
        await sendPhoto(token, chatId, photoData.file_id, photoCaption, null, botKeyValue);
        foundContent = true;
        console.log(`[handleGetCombinedCommand] Sent photo for keyword '${keyword}'.`);
    } else {
        console.log(`[handleGetCombinedCommand] No photo found for keyword '${keyword}'.`);
    }

    // Send file if found
    if (fileData && fileData.type === 'file' && fileData.file_id) {
        let fileCaption = '';
        if (fileData.title) {
            fileCaption += `<b>${fileData.title}</b>\n`;
        }
        if (fileData.description) {
            fileCaption += `${fileData.title ? '\n' : ''}<i>${fileData.description}</i>\n`;
        }

        await sendDocument(token, chatId, fileData.file_id, fileCaption, null, botKeyValue);
        foundContent = true;
        console.log(`[handleGetCombinedCommand] Sent file for keyword '${keyword}'.`);
    } else {
        console.log(`[handleGetCombinedCommand] No file found for keyword '${keyword}'.`);
    }

    // Send key content if found (if the combined command should also retrieve key data)
    if (keyData && keyData.type === 'key' && keyData.file_id) {
        let keyDisplayContent = '';
        if (keyData.title) {
            keyDisplayContent += `<b>${keyData.title}</b>\n`;
        }
        if (keyData.description) {
            keyDisplayContent += `${keyData.title ? '\n' : ''}<i>${keyData.description}</i>\n`;
        }
        
        // Wrap the actual key content in a Telegram code block
        keyDisplayContent += `<pre><code language="text">${keyData.file_id}</code></pre>`; 

        // Removed the custom "Copy Code" inline keyboard.
        // Telegram automatically adds a "Copy Code" button for <pre><code> blocks.
        // Adding our own resulted in a duplicate.

        await sendMessage(token, chatId, keyDisplayContent, 'HTML', null, botKeyValue); // reply_markup is null here
        foundContent = true;
        console.log(`[handleGetCombinedCommand] Sent key content for keyword '${keyword}'.`);
    } else {
        console.log(`[handleGetCombinedCommand] No key content found for keyword '${keyword}'.`);
    }

    if (!foundContent) { 
        await sendMessage(token, chatId, `❌ Keyword '${keyword}' နဲ့ ပတ်သက်တဲ့ Photo, File သို့မဟုတ် Key တစ်ခုမှ ရှာမတွေ့ပါဘူးရှင့်။`, 'HTML', null, botKeyValue);
        console.log(`[handleGetCombinedCommand] No content found for keyword '${keyword}'.`);
    }
}

