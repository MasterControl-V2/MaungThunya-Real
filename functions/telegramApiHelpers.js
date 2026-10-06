// telegramApiHelpers.js
// This file contains helper functions for interacting with the Telegram Bot API.

import { TELEGRAM_API } from './constants';

/**
 * Sends a message to a specified chat.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat to send the message to.
 * @param {string} text - The text of the message.
 * @param {string} [parse_mode='HTML'] - Parse mode for the message (e.g., 'HTML', 'MarkdownV2').
 * @param {object} [reply_markup=null] - Additional interface options (e.g., inline keyboard).
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object>} - The result of the API call.
 */
export async function sendMessage(token, chat_id, text, parse_mode = 'HTML', reply_markup = null, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/sendMessage`;
    const payload = { chat_id: chat_id, text: text, parse_mode: parse_mode, disable_web_page_preview: true };
    if (reply_markup) { payload.reply_markup = reply_markup; }
    try {
        console.log(`[sendMessage] Sending message to ${chat_id}: ${text.substring(0, 50)}...`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[sendMessage] Failed to send message: ${response.status} ${JSON.stringify(result)}`);
        }
        return result;
    } catch (error) {
        console.error("[sendMessage] Error sending message:", error);
        return { ok: false, description: error.message };
    }
}

/**
 * Deletes a message from a chat.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat.
 * @param {number} message_id - The ID of the message to delete.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function deleteMessage(token, chat_id, message_id, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/deleteMessage`;
    const payload = { chat_id: chat_id, message_id: message_id };
    try {
        console.log(`[deleteMessage] Deleting message ${message_id} from chat ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[deleteMessage] Failed to delete message: ${response.status} ${JSON.stringify(result)}`);
            return false;
        }
        return result.ok;
    } catch (error) {
        console.error("[deleteMessage] Error deleting message:", error);
        return false;
    }
}

/**
 * Restricts a user in a chat (e.g., mute).
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat.
 * @param {number} user_id - The ID of the user to restrict.
 * @param {number} until_date - Date when the user will be unmuted, Unix time. If 0, user is restricted forever.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function restrictChatMember(token, chat_id, user_id, until_date = 0, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/restrictChatMember`;
    const payload = {
        chat_id: chat_id,
        user_id: user_id,
        permissions: {
            can_send_messages: false,
            can_send_audios: false,
            can_send_documents: false,
            can_send_photos: false,
            can_send_videos: false,
            can_send_video_notes: false,
            can_send_voice_notes: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
            can_change_info: false,
            can_invite_users: false,
            can_pin_messages: false,
            can_manage_topics: false,
        },
        until_date: until_date
    };
    try {
        console.log(`[restrictChatMember] Restricting user ${user_id} in chat ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[restrictChatMember] Failed to restrict chat member: ${response.status} ${JSON.stringify(result)}`);
            return false;
        }
        return result.ok;
    } catch (error) {
        console.error("[restrictChatMember] Error restricting chat member:", error);
        return false;
    }
}

/**
 * Unrestricts a user in a chat (e.g., unmute).
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat.
 * @param {number} user_id - The ID of the user to unrestrict.
 * @param {number} until_date - Date when the user will be unmuted, Unix time. If 0, user is unrestricted forever.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function unrestrictChatMember(token, chat_id, user_id, until_date = 0, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/restrictChatMember`;
    const payload = {
        chat_id: chat_id,
        user_id: user_id,
        permissions: {
            can_send_messages: true,
            can_send_audios: true,
            can_send_documents: true,
            can_send_photos: true,
            can_send_videos: true,
            can_send_video_notes: true,
            can_send_voice_notes: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
            can_change_info: true,
            can_invite_users: true,
            can_pin_messages: true,
            can_manage_topics: true,
        },
        until_date: until_date
    };
    try {
        console.log(`[unrestrictChatMember] Unrestricting user ${user_id} in chat ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[unrestrictChatMember] Failed to unrestrict chat member: ${response.status} ${JSON.stringify(result)}`);
            return false;
        }
        return result.ok;
    } catch (error) {
        console.error("[unrestrictChatMember] Error unrestricting chat member:", error);
        return false;
    }
}

/**
 * Kicks a user from a chat.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat.
 * @param {number} user_id - The ID of the user to kick.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function kickChatMember(token, chat_id, user_id, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/kickChatMember`;
    const payload = { chat_id: chat_id, user_id: user_id };
    try {
        console.log(`[kickChatMember] Kicking user ${user_id} from chat ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[kickChatMember] Failed to kick chat member: ${response.status} ${JSON.stringify(result)}`);
            return false;
        }
        return result.ok;
    } catch (error) {
        console.error("[kickChatMember] Error kicking chat member:", error);
        return false;
    }
}

/**
 * Unbans a user from a chat.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat.
 * @param {number} user_id - The ID of the user to unban.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function unbanChatMember(token, chat_id, user_id, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/unbanChatMember`;
    const payload = { chat_id: chat_id, user_id: user_id };
    try {
        console.log(`[unbanChatMember] Unbanning user ${user_id} from chat ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[unbanChatMember] Failed to unban chat member: ${response.status} ${JSON.stringify(result)}`);
            return false;
        }
        return result.ok;
    } catch (error) {
        console.error("[unbanChatMember] Error unbanning chat member:", error);
        return false;
    }
}

/**
 * Sends a photo to a specified chat.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat to send the photo to.
 * @param {string} photo_id - File ID of the photo to send.
 * @param {string} [caption=''] - Photo caption (may also be used as HTML or Markdown).
 * @param {object} [reply_markup=null] - Additional interface options.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object>} - The result of the API call.
 */
export async function sendPhoto(token, chat_id, photo_id, caption = '', reply_markup = null, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/sendPhoto`;
    const payload = { chat_id: chat_id, photo: photo_id, caption: caption, parse_mode: 'HTML' };
    if (reply_markup) { payload.reply_markup = reply_markup; }
    try {
        console.log(`[sendPhoto] Sending photo to ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[sendPhoto] Failed to send photo: ${response.status} ${JSON.stringify(result)}`);
        }
        return result;
    } catch (error) {
        console.error("[sendPhoto] Error sending photo:", error);
        return { ok: false, description: error.message };
    }
}

/**
 * Sends a document (file) to a specified chat.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat to send the document to.
 * @param {string} document_id - File ID of the document to send.
 * @param {string} [caption=''] - Document caption (may also be used as HTML or Markdown).
 * @param {object} [reply_markup=null] - Additional interface options.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object>} - The result of the API call.
 */
export async function sendDocument(token, chat_id, document_id, caption = '', reply_markup = null, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/sendDocument`;
    const payload = { chat_id: chat_id, document: document_id, caption: caption, parse_mode: 'HTML' };
    if (reply_markup) { payload.reply_markup = reply_markup; }
    try {
        console.log(`[sendDocument] Sending document to ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[sendDocument] Failed to send document: ${response.status} ${JSON.stringify(result)}`);
        }
        return result;
    } catch (error) {
        console.error("[sendDocument] Error sending document:", error);
        return { ok: false, description: error.message };
    }
}

/**
 * Retrieves information about the bot.
 * @param {string} token - Telegram Bot Token.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object|null>} - Bot information object or null on failure.
 */
export async function getMe(token, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/getMe`;
    try {
        console.log("[getMe] Fetching bot information.");
        const response = await fetch(apiUrl, {
            headers: {
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            }
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[getMe] Failed to get bot info: ${response.status} ${JSON.stringify(result)}`);
            return null;
        }
        return result.result;
    } catch (error) {
        console.error("[getMe] Error fetching bot info:", error);
        return null;
    }
}

/**
 * Retrieves information about a chat member.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat.
 * @param {number} user_id - The ID of the user.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object|null>} - Chat member information object or null on failure.
 */
export async function getChatMember(token, chat_id, user_id, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/getChatMember`;
    const payload = { chat_id: chat_id, user_id: user_id };
    try {
        console.log(`[getChatMember] Fetching info for user ${user_id} in chat ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[getChatMember] Failed to get chat member info: ${response.status} ${JSON.stringify(result)}`);
            return null;
        }
        return result.result;
    } catch (error) {
        console.error("[getChatMember] Error fetching chat member info:", error);
        return null;
    }
}

/**
 * Answers a callback query from an inline keyboard.
 * @param {string} token - Telegram Bot Token.
 * @param {string} callback_query_id - Unique identifier for the query to be answered.
 * @param {string} [text=''] - Text of the notification that will be shown to the user.
 * @param {boolean} [show_alert=false] - If true, an alert will be shown instead of a notification.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object>} - The result of the API call.
 */
export async function answerCallbackQuery(token, callback_query_id, text = '', show_alert = false, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/answerCallbackQuery`;
    const payload = { callback_query_id: callback_query_id, text: text, show_alert: show_alert };
    try {
        console.log(`[answerCallbackQuery] Answering callback query ${callback_query_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[answerCallbackQuery] Failed to answer callback query: ${response.status} ${JSON.stringify(result)}`);
        }
        return result;
    } catch (error) {
        console.error("[answerCallbackQuery] Error answering callback query:", error);
        return { ok: false, description: error.message };
    }
}

/**
 * Edits the text of a message sent by the bot.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chat_id - The ID of the chat.
 * @param {number} message_id - The ID of the message to edit.
 * @param {string} text - New text of the message.
 * @param {string} [parse_mode='HTML'] - Parse mode for the message.
 * @param {object} [reply_markup=null] - New inline keyboard.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object>} - The result of the API call.
 */
export async function editMessageText(token, chat_id, message_id, text, parse_mode = 'HTML', reply_markup = null, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/editMessageText`;
    const payload = { chat_id: chat_id, message_id: message_id, text: text, parse_mode: parse_mode, disable_web_page_preview: true };
    if (reply_markup) { payload.reply_markup = reply_markup; }
    try {
        console.log(`[editMessageText] Editing message ${message_id} in chat ${chat_id}.`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[editMessageText] Failed to edit message text: ${response.status} ${JSON.stringify(result)}`);
        }
        return result;
    } catch (error) {
        console.error("[editMessageText] Error editing message text:", error);
        return { ok: false, description: error.message };
    }
}

/**
 * Checks a URL's safety using Google Safe Browsing API.
 * @param {string} url - The URL to check.
 * @param {string} apiKey - Google Safe Browsing API Key.
 * @returns {Promise<{isSafe: boolean, threats: string[]}>} - Safety report.
 */
export async function checkUrlSafety(url, apiKey) {
    const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
    const payload = {
        client: {
            clientId: "telegram-bot",
            clientVersion: "1.0.0"
        },
        threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: url }]
        }
    };

    try {
        console.log(`[checkUrlSafety] Checking URL: ${url}`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // IMPORTANT: Referer header is crucial if API key has HTTP Referrer restrictions
                // Replace with your actual Cloudflare Pages domain
                'Referer': 'https://6file-km7.pages.dev/' 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            console.error(`[checkUrlSafety] Google Safe Browsing API error: ${response.status} ${JSON.stringify(result)}`);
            // Sanitize error message to prevent Telegram HTML parse errors
            const errorMessage = result.error?.message || "Unknown API error";
            const sanitizedErrorMessage = errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return { isSafe: false, threats: [`API Error: ${sanitizedErrorMessage}`] };
        }

        if (result.matches && result.matches.length > 0) {
            const threats = result.matches.map(match => match.threatType);
            console.log(`[checkUrlSafety] URL is NOT safe. Threats: ${threats.join(', ')}`);
            return { isSafe: false, threats: threats };
        } else {
            console.log(`[checkUrlSafety] URL is safe.`);
            return { isSafe: true, threats: [] };
        }
    } catch (error) {
        console.error("[checkUrlSafety] Error calling Google Safe Browsing API:", error);
        // Sanitize error message
        const sanitizedErrorMessage = error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return { isSafe: false, threats: [`Network Error: ${sanitizedErrorMessage}`] };
    }
}

/**
 * Fetches exchange rates from a custom worker API.
 * @param {string} baseCurrency - The base currency code (e.g., "USD").
 * @param {number} amount - The amount of the base currency.
 * @param {string} targetCurrency - The target currency code (e.g., "MMK").
 * @returns {Promise<{base: string, target: string, rate: number, convertedAmount: number, lastUpdate: string}|null>} - Exchange rate data.
 */
export async function fetchExchangeRates(baseCurrency, amount, targetCurrency) {
    // Using the provided custom worker API for exchange rates
    const apiUrl = `https://real-time-global-exchange-rates.bjcoderx.workers.dev/?From=${baseCurrency}&Amount=${amount}&To=${targetCurrency}`;

    try {
        console.log(`[fetchExchangeRates] Fetching exchange rate for ${amount} ${baseCurrency} to ${targetCurrency}.`);
        const response = await fetch(apiUrl);
        const result = await response.json();

        if (!response.ok || result.result === "error") {
            console.error(`[fetchExchangeRates] ExchangeRate-API error: ${response.status} ${JSON.stringify(result)}`);
            return null;
        }

        // Fix: Parse converted_amount and rate to numbers
        const convertedAmountNum = parseFloat(result.converted_amount);
        const rateNum = parseFloat(result.rate);

        if (!isNaN(convertedAmountNum) && !isNaN(rateNum)) { // Check if parsing was successful
            console.log(`[fetchExchangeRates] Rate for ${baseCurrency} to ${targetCurrency}: ${rateNum}, Converted Amount: ${convertedAmountNum}`);
            // Use current time in 'Asia/Bangkok' timezone for lastUpdate
            const currentThaiTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' });

            return {
                base: result.base_code,
                target: result.target_code,
                rate: rateNum, // Use the parsed number
                convertedAmount: convertedAmountNum, // Use the parsed number
                lastUpdate: currentThaiTime 
            };
        } else {
            console.error("[fetchExchangeRates] ExchangeRate-API returned invalid conversion_rate or converted_amount (not numbers):", result);
            return null;
        }
    } catch (error) {
        console.error("[fetchExchangeRates] Error calling ExchangeRate-API:", error);
        return null;
    }
}

/**
 * Sets the bot's commands for a given scope.
 * @param {string} token - Telegram Bot Token.
 * @param {Array<object>} commands - An array of command objects {command: string, description: string}.
 * @param {string} [scopeType='all_private_chats'] - Type of scope for the commands.
 * @param {number} [chatId] - Required if scopeType is 'chat' or 'chat_administrators'.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setMyCommands(token, commands, scopeType = 'all_private_chats', chatId = null, botKeyValue) {
    const apiUrl = `${TELEGRAM_API}${token}/setMyCommands`;
    const payload = {
        commands: commands,
        scope: { type: scopeType }
    };

    if (chatId && (scopeType === 'chat' || scopeType === 'chat_administrators')) {
        payload.scope.chat_id = chatId;
    }

    try {
        console.log(`[setMyCommands] Setting commands for scope type: ${scopeType}`);
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(botKeyValue && { "X-Bot-Key": botKeyValue }) 
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error(`[setMyCommands] Failed to set commands: ${response.status} ${JSON.stringify(result)}`);
            return false;
        }
        console.log(`[setMyCommands] Commands set successfully for scope type: ${scopeType}`);
        return true;
    } catch (error) {
        console.error("[setMyCommands] Error setting commands:", error);
        return false;
    }
}

