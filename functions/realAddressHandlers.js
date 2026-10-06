// realAddressHandlers.js
// This file handles /fake, /address commands and Re-Generate callback.
// Uses realAddressGenerator.js which calls the custom API.
// API URL: https://address-api.baegyee404.workers.dev

import { sendMessage, answerCallbackQuery, editMessageText } from './telegramApiHelpers';
import { 
    generateRealAddress, 
    isCountrySupported, 
    getSupportedCountries 
} from './realAddressGenerator';

/**
 * Formats an address object into a beautiful Telegram HTML message.
 * Includes all fields from the API: name, gender, street, city, state,
 * postal code, phone, email, DOB, password, country, currency.
 * 
 * @param {object} address - Address object from generateRealAddress.
 * @returns {string} - Formatted HTML string.
 */
function formatAddressMessage(address) {
    let text = `<b>Address for ${address.country} ${address.flag}</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `- <b>Street</b> : <code>${address.street}</code>\n`;
    text += `- <b>Street Name</b> : <code>${address.streetName}</code>\n`;
    text += `- <b>Currency</b> : <code>${address.currency}</code>\n`;
    text += `- <b>Full Name</b> : <code>${address.fullName}</code>\n`;
    text += `- <b>City/Town/Village</b> : <code>${address.city}</code>\n`;
    text += `- <b>Gender</b> : <code>${address.gender}</code>\n`;
    text += `- <b>Postal Code</b> : <code>${address.postalCode}</code>\n`;
    text += `- <b>Phone Number</b> : <code>${address.phoneNumber}</code>\n`;
    text += `- <b>State</b> : <code>${address.state}</code>\n`;
    text += `- <b>Country</b> : <code>${address.country}</code>\n`;
    
    // Add extra fields if available from API
    if (address.email && address.email !== 'N/A') {
        text += `- <b>Email</b> : <code>${address.email}</code>\n`;
    }
    if (address.dateOfBirth && address.dateOfBirth !== 'N/A') {
        text += `- <b>Date of Birth</b> : <code>${address.dateOfBirth}</code>\n`;
    }
    if (address.password && address.password !== 'N/A') {
        text += `- <b>Password</b> : <code>${address.password}</code>\n`;
    }
    
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `<i>Click the button below to generate another address.</i>`;
    
    return text;
}

/**
 * Handles the /fake and /address commands.
 * Usage: /fake <country_code> or /address <country_code>
 * 
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleRealAddressCommand(message, token, botKeyValue) {
    const chatId = message.chat.id;
    const args = message.text.trim().split(/\s+/);
    const command = args[0].toLowerCase();

    // No country code provided — show usage
    if (args.length < 2) {
        const supportedCountries = getSupportedCountries();
        const countryList = supportedCountries.map(code => `<code>${code}</code>`).join(', ');
        await sendMessage(
            token,
            chatId,
            `Usage: <code>${command} &lt;country_code&gt;</code>\n` +
            `Example: <code>${command} US</code>\n\n` +
            `<b>Supported Countries (${supportedCountries.length}):</b>\n${countryList}`,
            'HTML',
            null,
            botKeyValue
        );
        return;
    }

    const countryCode = args[1].toUpperCase();

    // Country not supported
    if (!isCountrySupported(countryCode)) {
        const supportedCountries = getSupportedCountries();
        const countryList = supportedCountries.map(code => `<code>${code}</code>`).join(', ');
        await sendMessage(
            token,
            chatId,
            `❌ Country code <b>${countryCode}</b> is not supported.\n\n` +
            `<b>Supported Countries (${supportedCountries.length}):</b>\n${countryList}`,
            'HTML',
            null,
            botKeyValue
        );
        return;
    }

    // Send "loading" message
    const loadingMsg = await sendMessage(
        token,
        chatId,
        `🔄 Fetching real address for <b>${countryCode}</b>...`,
        'HTML',
        null,
        botKeyValue
    );

    // Fetch from API (async)
    const address = await generateRealAddress(countryCode);

    if (!address) {
        const errorText = "❌ Failed to generate address. The API might be down. Please try again later.";
        if (loadingMsg && loadingMsg.result && loadingMsg.result.message_id) {
            await editMessageText(
                token, 
                chatId, 
                loadingMsg.result.message_id, 
                errorText, 
                'HTML', 
                null, 
                botKeyValue
            );
        } else {
            await sendMessage(token, chatId, errorText, 'HTML', null, botKeyValue);
        }
        return;
    }

    const responseText = formatAddressMessage(address);
    const reply_markup = {
        inline_keyboard: [[
            { text: '🔄 Re-Generate', callback_data: `regen_address_${countryCode}` }
        ]]
    };

    // Edit the loading message with the actual address
    if (loadingMsg && loadingMsg.result && loadingMsg.result.message_id) {
        await editMessageText(
            token,
            chatId,
            loadingMsg.result.message_id,
            responseText,
            'HTML',
            reply_markup,
            botKeyValue
        );
    } else {
        // Fallback: send as new message
        await sendMessage(token, chatId, responseText, 'HTML', reply_markup, botKeyValue);
    }
}

/**
 * Handles the Re-Generate button callback.
 * Called from updateHandlers.js handleCallbackQuery.
 * 
 * @param {object} callbackQuery - Telegram CallbackQuery object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @param {string} countryCode - The country code to regenerate for.
 * @param {string} messageId - The message ID to edit.
 */
export async function handleRegenerateAddress(callbackQuery, token, env, botKeyValue, countryCode, messageId) {
    const chatId = callbackQuery.message.chat.id;

    // Validate country
    if (!isCountrySupported(countryCode)) {
        await answerCallbackQuery(
            token, 
            callbackQuery.id, 
            `❌ Country ${countryCode} is not supported.`, 
            true, 
            botKeyValue
        );
        return;
    }

    // Acknowledge the callback immediately
    await answerCallbackQuery(
        token, 
        callbackQuery.id, 
        `🔄 Generating new address for ${countryCode}...`, 
        false, 
        botKeyValue
    );

    // Fetch new address from API
    const address = await generateRealAddress(countryCode);

    if (!address) {
        await answerCallbackQuery(
            token, 
            callbackQuery.id, 
            `❌ Failed to generate address. API might be down.`, 
            true, 
            botKeyValue
        );
        return;
    }

    const responseText = formatAddressMessage(address);
    const reply_markup = {
        inline_keyboard: [[
            { text: '🔄 Re-Generate', callback_data: `regen_address_${countryCode}` }
        ]]
    };

    // Edit the existing message
    await editMessageText(
        token, 
        chatId, 
        messageId, 
        responseText, 
        'HTML', 
        reply_markup, 
        botKeyValue
    );
}
