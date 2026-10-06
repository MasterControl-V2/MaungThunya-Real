// commandHandlers.js
// This file contains functions that handle specific Telegram bot commands.

import { 
    sendMessage, 
    checkUrlSafety, 
    fetchExchangeRates,
    getMe,
    getChatMember,
    restrictChatMember,
    unbanChatMember,
    unrestrictChatMember,
    kickChatMember
} from './telegramApiHelpers';
import { 
    isUserAdmin, 
    getUserInfoDetails, 
    getWarnings, 
    setWarning, 
    clearWarnings,
    getAdminIds,
    getAdminNames,
    isUserOwner,
    // NEW: Ban list functions
    setBannedUser,
    removeBannedUser,
    getBannedUsers,
    getBannedUser
} from './userManagementFunctions'; 
import { 
    getMMKOffset,
    setMMKOffset,
    getTHBOffset,
    setTHBOffset
} from './forexKvInteractions';
import {
    GOOGLE_SAFE_BROWSING_API_KEY,
    FIXED_ACCOUNT_CREATION_DATES,
    OWNER_ADMIN_IDS
} from './constants';


/**
 * Extracts a URL from a given text.
 * @param {string} text - The text to extract the URL from.
 * @returns {string|null} - The first found URL, or null if none.
 */
function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches && matches.length > 0 ? matches[0] : null;
}

/**
 * Handles the /checkurl command.
 * Allows an admin to check the safety of a URL.
 * Supports providing URL as an argument or replying to a message containing a URL.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleCheckUrlCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id.toString(); // Convert to string for consistency
    const fromUser = message.from;
    const args = message.text.split(' ');
    const replyToMessage = message.reply_to_message;

    // Admin check is done in _middleware.js before calling this function.

    let urlToCheck = null;

    if (replyToMessage && replyToMessage.text) {
        urlToCheck = extractUrl(replyToMessage.text);
    } else if (args.length > 1) {
        urlToCheck = extractUrl(args[1]); // Assume the URL is the second argument
    }

    if (!urlToCheck) {
        await sendMessage(token, chatId, "Usage: <code>/checkurl &lt;url&gt;</code> (or) reply to a message containing a URL with <code>/checkurl</code>.", 'HTML', null, botKeyValue);
        return;
    }

    await sendMessage(token, chatId, `🌐 Checking URL <b>${urlToCheck}</b>... Please wait.`, 'HTML', null, botKeyValue);

    const safetyReport = await checkUrlSafety(urlToCheck, GOOGLE_SAFE_BROWSING_API_KEY);

    let responseText = `<b>URL Safety Report for:</b> <code>${urlToCheck}</code>\n\n`;

    if (safetyReport.isSafe) {
        responseText += "✅ <b>Safe.</b> No suspicious activities found in this URL.";
    } else {
        responseText += "🚨 <b>Potentially Dangerous.</b> The following threats were found in this URL:\n";
        safetyReport.threats.forEach(threat => {
            const sanitizedThreat = threat.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            responseText += `  - <b>${sanitizedThreat.replace(/_/g, ' ').toLowerCase()}</b>\n`;
        });
        responseText += "\n<b>Warning:</b> Avoid accessing this URL.";
    }

    await sendMessage(token, chatId, responseText, 'HTML', null, botKeyValue);
}

/**
 * Handles the /forex command to fetch real-time exchange rates.
 * Supports: /forex <amount> <from_currency> to <to_currency>
 * Example: /forex 100 USD to MMK
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object. 
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleForexCommand(message, token, env, botKeyValue) { 
    const chatId = message.chat.id;
    const args = message.text.split(' ');

    if (args.length < 5 || args[3].toLowerCase() !== 'to') {
        await sendMessage(token, chatId, "Usage: <code>/forex &lt;amount&gt; &lt;from_currency&gt; to &lt;to_currency&gt;</code>\nExample: <code>/forex 100 USD to MMK</code>", 'HTML', null, botKeyValue);
        return;
    }

    const amount = parseFloat(args[1]);

    const fromCurrency = args[2].toUpperCase();
    const toCurrency = args[4].toUpperCase();

    if (isNaN(amount) || amount <= 0) {
        await sendMessage(token, chatId, "Amount must be a valid number greater than 0.", 'HTML', null, botKeyValue);
        return;
    }

    const supportedCurrencies = ['THB', 'MMK', 'SGD', 'MYR', 'IDR', 'PHP', 'VN', 'KHR', 'LA', 'BN', 'USD'];

    if (!supportedCurrencies.includes(fromCurrency) || !supportedCurrencies.includes(toCurrency)) {
        await sendMessage(token, chatId, `Supported currencies: ${supportedCurrencies.join(', ')}`, 'HTML', null, botKeyValue);
        return;
    }

    await sendMessage(token, chatId, `🔄 Converting ${amount.toLocaleString()} ${fromCurrency} to ${toCurrency}... Please wait.`, 'HTML', null, botKeyValue);

    const exchangeRateData = await fetchExchangeRates(fromCurrency, amount, toCurrency);

    if (exchangeRateData && exchangeRateData.rate && exchangeRateData.convertedAmount) {
        const lastUpdateDate = new Date(exchangeRateData.lastUpdate);
        const datePart = lastUpdateDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timePart = lastUpdateDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

        let responseText = "";
        
        if (fromCurrency === 'THB' && toCurrency === 'MMK') {
            const globalConvertedAmountRounded = Math.round(exchangeRateData.convertedAmount);
            const globalConvertedAmountFormatted = globalConvertedAmountRounded.toLocaleString();
            
            let estimatedConvertedAmount = exchangeRateData.convertedAmount;
            const mmkOffset = await getMMKOffset(env);
            if (mmkOffset !== 0) {
                const offsetAmount = amount * mmkOffset; 
                estimatedConvertedAmount += offsetAmount;
            }
            estimatedConvertedAmount = Math.round(estimatedConvertedAmount);
            const estimatedConvertedAmountFormatted = estimatedConvertedAmount.toLocaleString();

            responseText = `
<b>📊Global Currency Market:</b>
     
     <b>${amount.toLocaleString()} ${fromCurrency}</b> = <b>${globalConvertedAmountFormatted} ${toCurrency}</b>
━━━━━━━━━━━━━━━━━
<b>📊Estimated Rate:</b> 
     
    <b>${amount.toLocaleString()} ${fromCurrency}</b> = <b>${estimatedConvertedAmountFormatted} ${toCurrency}</b> 
 ━━━━━━━━━━━━━━━━━
(update: ${datePart})
(${timePart})
            `;
        } 
        else if (fromCurrency === 'MMK' && toCurrency === 'THB') {
            let estimatedConvertedAmount = exchangeRateData.convertedAmount;
            const thbOffset = await getTHBOffset(env);
            if (thbOffset !== 0) {
                const offsetAmount = amount * thbOffset; 
                estimatedConvertedAmount += offsetAmount; 
            }
            estimatedConvertedAmount = Math.round(estimatedConvertedAmount);
            const estimatedConvertedAmountFormatted = estimatedConvertedAmount.toLocaleString();

            responseText = `
<b>📊Estimated Rate:</b> 
     
    <b>${amount.toLocaleString()} ${fromCurrency}</b> = <b>${estimatedConvertedAmountFormatted} ${toCurrency}</b> 
 ━━━━━━━━━━━━━━━━━
(update: ${datePart})
(${timePart})
            `;
        }
        else {
            const globalConvertedAmountRounded = Math.round(exchangeRateData.convertedAmount);
            const globalConvertedAmountFormatted = globalConvertedAmountRounded.toLocaleString();
            responseText = `
<b>📊Global Currency Market:</b>
     
     <b>${amount.toLocaleString()} ${fromCurrency}</b> = <b>${globalConvertedAmountFormatted} ${toCurrency}</b>
━━━━━━━━━━━━━━━━━
(update: ${datePart})
(${timePart})
            `;
        }
        
        await sendMessage(token, chatId, responseText, 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, `❌ Failed to fetch exchange rate for ${fromCurrency} to ${toCurrency}. Please try again later.`, 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /setmmkoffset command to set the MMK conversion offset.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleSetMMKOffsetCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');

    if (args.length < 2) {
        await sendMessage(token, chatId, "Usage: <code>/setmmkoffset &lt;offset_value&gt;</code>\nExample: <code>/setmmkoffset 32.40</code>", 'HTML', null, botKeyValue);
        return;
    }

    const offsetValue = parseFloat(args[1]);

    if (isNaN(offsetValue)) {
        await sendMessage(token, chatId, "Offset value must be a valid number.", 'HTML', null, botKeyValue);
        return;
    }

    const success = await setMMKOffset(offsetValue, env);

    if (success) {
        await sendMessage(token, chatId, `✅ MMK Offset has been set to <b>${offsetValue}</b>.`, 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, "❌ Failed to set MMK Offset.", 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /setthboffset command to set the THB conversion offset.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleSetTHBOffsetCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');

    if (args.length < 2) {
        await sendMessage(token, chatId, "Usage: <code>/setthboffset &lt;offset_value&gt;</code>\nExample: <code>/setthboffset -0.0024</code>", 'HTML', null, botKeyValue);
        return;
    }

    const offsetValue = parseFloat(args[1]);

    if (isNaN(offsetValue)) {
        await sendMessage(token, chatId, "Offset value must be a valid number.", 'HTML', null, botKeyValue);
        return;
    }

    const success = await setTHBOffset(offsetValue, env);

    if (success) {
        await sendMessage(token, chatId, `✅ THB Offset has been set to <b>${offsetValue}</b>.`, 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, "❌ Failed to set THB Offset.", 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /start command.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleStartCommand(message, token, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    console.log(`[handleStartCommand] Received /start command from chat ${chatId}.`);
    await sendMessage(token, chatId, `Hello <a href="tg://user?id=${fromUser.id}">${fromUser.first_name}</a>! I'm a Link Checker Bot. I monitor group members' name changes, unwanted links, and other suspicious activity.`, 'HTML', null, botKeyValue);
}

/**
 * Handles the /ban command when replying to a message.
 * Permanent ban only. Space-separated text after /ban becomes the reason message.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleReplyBanCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');
    const replyToMessage = message.reply_to_message;
    console.log(`[handleReplyBanCommand] Received reply-based /ban command from user ${fromUser.id} in chat ${chatId}.`);

    // Only check if sender is a BOT ADMIN (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        console.log(`[handleReplyBanCommand] User ${fromUser.id} is not a bot admin. Sending unauthorized message.`);
        await sendMessage(token, chatId, `<a href="tg://user?id=${fromUser.id}"><b>${fromUser.first_name || fromUser.username || "Unknown"}</b></a> <b>🚫 You don't have permission to use this command!</b>`, 'HTML', null, botKeyValue);
        return;
    }

    if (!replyToMessage) { 
        console.log("[handleReplyBanCommand] No reply message. Prompting user."); 
        await sendMessage(token, chatId, "Please reply to the user's message you want to ban.", 'HTML', null, botKeyValue); 
        return; 
    }
    const targetUser = replyToMessage.from;
    const targetUserId = targetUser.id;
    console.log(`[handleReplyBanCommand] Target user for ban: ${targetUserId}.`);
    const botInfo = await getMe(token, botKeyValue);
    if (botInfo && targetUserId === botInfo.id) { 
        console.log("[handleReplyBanCommand] Attempted to ban/mute self. Ignoring."); 
        await sendMessage(token, chatId, "I cannot ban myself.", 'HTML', null, botKeyValue); 
        return; 
    }
    
    // Check if target user is a bot admin (don't allow banning other bot admins)
    const isTargetBotAdmin = await isUserAdmin(targetUserId, env);
    if (isTargetBotAdmin) { 
        console.log(`[handleReplyBanCommand] Target user ${targetUserId} is a bot admin. Cannot ban/mute.`); 
        await sendMessage(token, chatId, "I cannot ban a bot administrator.", 'HTML', null, botKeyValue); 
        return; 
    }

    // Extract custom message from args (everything after /ban)
    const customMessage = args.slice(1).join(' ').trim();

    const targetUserDisplayName = targetUser.first_name || targetUser.username || "Unknown User";
    const userLink = `<a href='tg://user?id=${targetUserId}'><b>${targetUserDisplayName}</b></a>`;
    let success = false;

    console.log(`[handleReplyBanCommand] Performing permanent ban action for ${targetUserId}.`);
    // Always permanent (untilDate = 0)
    success = await kickChatMember(token, chatId, targetUserId, 0, botKeyValue);

    if (success) {
        // Add user to ban list KV
        const banRecord = {
            id: targetUserId,
            name: targetUserDisplayName,
            username: targetUser.username ? `@${targetUser.username}` : null,
            bannedAt: new Date().toISOString(),
            bannedBy: fromUser.id,
            bannedByName: fromUser.first_name || fromUser.username || "Unknown Admin"
        };
        await setBannedUser(chatId, banRecord, env);

        let messageText = `🚫 ${userLink} has been permanently banned from the group.`;
        if (customMessage) {
            messageText += `\n\n<b>📝 Reason:</b>\n<i>${customMessage}</i>`;
        }

        const inlineKeyboard = { inline_keyboard: [[{ text: "✅ Unban", callback_data: `unban_${targetUserId}_${chatId}` }]] };
        await sendMessage(token, chatId, messageText, 'HTML', inlineKeyboard, botKeyValue);
    } else {
        const messageText = `❌ Failed to ban ${userLink}. Please check the bot's permissions.`;
        await sendMessage(token, chatId, messageText, 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /ban <user_id> command.
 * Permanent ban only. Space-separated text after user_id becomes the reason message.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleBanCommandById(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');
    console.log(`[handleBanCommandById] Received /ban <user_id> command from user ${fromUser.id} in chat ${chatId}.`);

    // Only check if sender is a BOT ADMIN (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        console.log(`[handleBanCommandById] User ${fromUser.id} is not a bot admin. Sending unauthorized message.`);
        await sendMessage(token, chatId, `<a href="tg://user?id=${fromUser.id}"><b>${fromUser.first_name || fromUser.username || "Unknown"}</b></a> <b>🚫 You don't have permission to use this command!</b>`, 'HTML', null, botKeyValue);
        return;
    }

    // Only require user_id as first arg. Everything after is custom message.
    if (args.length < 2 || isNaN(parseInt(args[1]))) {
        await sendMessage(token, chatId, "Usage: <code>/ban &lt;user_id&gt; [reason message]</code>", 'HTML', null, botKeyValue);
        return;
    }

    const targetUserId = parseInt(args[1]);
    // Extract custom message (everything after user_id)
    const customMessage = args.slice(2).join(' ').trim();
    
    const botInfo = await getMe(token, botKeyValue);
    if (botInfo && targetUserId === botInfo.id) {
        await sendMessage(token, chatId, "I cannot ban myself.", 'HTML', null, botKeyValue);
        return;
    }

    // Check if target user is a bot admin (don't allow banning other bot admins)
    const isTargetBotAdmin = await isUserAdmin(targetUserId, env);
    if (isTargetBotAdmin) {
        await sendMessage(token, chatId, "I cannot ban a bot administrator.", 'HTML', null, botKeyValue);
        return;
    }

    // Try to get user info
    let targetUserDisplayName = `User ${targetUserId}`;
    let targetUsername = null;
    try {
        const targetUserInfo = await getChatMember(token, chatId, targetUserId, botKeyValue);
        if (targetUserInfo && targetUserInfo.user) {
            targetUserDisplayName = targetUserInfo.user.first_name || targetUserInfo.user.username || targetUserDisplayName;
            if (targetUserInfo.user.last_name) {
                targetUserDisplayName += ` ${targetUserInfo.user.last_name}`;
            }
            targetUsername = targetUserInfo.user.username || null;
        }
    } catch (e) {
        console.warn(`[handleBanCommandById] Could not get user info for ID ${targetUserId}. Using default display name.`);
    }

    const userLink = `<a href='tg://user?id=${targetUserId}'><b>${targetUserDisplayName}</b></a>`;
    let success = false;

    console.log(`[handleBanCommandById] Performing permanent ban action for user ID: ${targetUserId}.`);
    // Always permanent (untilDate = 0)
    success = await kickChatMember(token, chatId, targetUserId, 0, botKeyValue);

    if (success) {
        // Add user to ban list KV
        const banRecord = {
            id: targetUserId,
            name: targetUserDisplayName,
            username: targetUsername ? `@${targetUsername}` : null,
            bannedAt: new Date().toISOString(),
            bannedBy: fromUser.id,
            bannedByName: fromUser.first_name || fromUser.username || "Unknown Admin"
        };
        await setBannedUser(chatId, banRecord, env);

        let messageText = `🚫 ${userLink} has been permanently banned from the group.`;
        if (customMessage) {
            messageText += `\n\n<b>📝 Reason:</b>\n<i>${customMessage}</i>`;
        }

        const inlineKeyboard = { inline_keyboard: [[{ text: "✅ Unban", callback_data: `unban_${targetUserId}_${chatId}` }]] };
        await sendMessage(token, chatId, messageText, 'HTML', inlineKeyboard, botKeyValue);
    } else {
        const messageText = `❌ Failed to ban ${userLink}. Please check the bot's permissions.`;
        await sendMessage(token, chatId, messageText, 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /mute command. Supports both reply and user_id.
 * Permanent mute only. Space-separated text after /mute becomes the reason message.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleMuteCommandById(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');
    const replyToMessage = message.reply_to_message;
    console.log(`[handleMuteCommandById] Received /mute command from user ${fromUser.id} in chat ${chatId}.`);

    // Only check if sender is a BOT ADMIN (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        console.log(`[handleMuteCommandById] User ${fromUser.id} is not a bot admin. Sending unauthorized message.`);
        await sendMessage(token, chatId, `<a href="tg://user?id=${fromUser.id}"><b>${fromUser.first_name || fromUser.username || "Unknown"}</b></a> <b>🚫 You don't have permission to use this command!</b>`, 'HTML', null, botKeyValue);
        return;
    }

    // Support both reply and user_id
    let targetUserId = null;
    let customMessage = '';

    if (replyToMessage) {
        // Reply case: use replied user's ID
        targetUserId = replyToMessage.from.id;
        // Custom message is everything after /mute
        customMessage = args.slice(1).join(' ').trim();
        console.log(`[handleMuteCommandById] Reply case. Target: ${targetUserId}`);
    } else if (args.length >= 2 && !isNaN(parseInt(args[1]))) {
        // ID case: use provided user ID
        targetUserId = parseInt(args[1]);
        // Custom message is everything after user_id
        customMessage = args.slice(2).join(' ').trim();
        console.log(`[handleMuteCommandById] ID case. Target: ${targetUserId}`);
    } else {
        await sendMessage(token, chatId, "Usage: reply to a message with <code>/mute [reason]</code> OR <code>/mute &lt;user_id&gt; [reason]</code>", 'HTML', null, botKeyValue);
        return;
    }

    if (!targetUserId) {
        await sendMessage(token, chatId, "Invalid user ID or no replied message.", 'HTML', null, botKeyValue);
        return;
    }
    
    const botInfo = await getMe(token, botKeyValue);
    if (botInfo && targetUserId === botInfo.id) {
        await sendMessage(token, chatId, "I cannot mute myself.", 'HTML', null, botKeyValue);
        return;
    }

    // Check if target user is a bot admin (don't allow muting other bot admins)
    const isTargetBotAdmin = await isUserAdmin(targetUserId, env);
    if (isTargetBotAdmin) {
        await sendMessage(token, chatId, "I cannot mute a bot administrator.", 'HTML', null, botKeyValue);
        return;
    }

    // Get user info for display name
    let targetUserDisplayName = `User ${targetUserId}`;
    try {
        const targetUserInfo = await getChatMember(token, chatId, targetUserId, botKeyValue);
        if (targetUserInfo && targetUserInfo.user) {
            targetUserDisplayName = targetUserInfo.user.first_name || targetUserInfo.user.username || targetUserDisplayName;
            if (targetUserInfo.user.last_name) {
                targetUserDisplayName += ` ${targetUserInfo.user.last_name}`;
            }
        }
    } catch (e) {
        console.warn(`[handleMuteCommandById] Could not get user info for ID ${targetUserId}. Using default display name.`);
    }

    const userLink = `<a href='tg://user?id=${targetUserId}'><b>${targetUserDisplayName}</b></a>`;
    let success = false;

    console.log(`[handleMuteCommandById] Performing permanent mute action for user ID: ${targetUserId}.`);
    // Always permanent (untilDate = 0)
    success = await restrictChatMember(token, chatId, targetUserId, 0, botKeyValue);

    if (success) {
        let messageText = `✅ ${userLink} has been muted indefinitely in the group.`;
        if (customMessage) {
            messageText += `\n\n<b>📝 Reason:</b>\n<i>${customMessage}</i>`;
        }
        const inlineKeyboard = { inline_keyboard: [[{ text: "✅ Unmute", callback_data: `unmute_${targetUserId}_${chatId}` }]] };
        await sendMessage(token, chatId, messageText, 'HTML', inlineKeyboard, botKeyValue);
    } else {
        const messageText = `❌ Failed to mute ${userLink}. Please check the bot's permissions.`;
        await sendMessage(token, chatId, messageText, 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /banlist command.
 * Shows all banned users in the current chat with their names and IDs.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleBanListCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;

    console.log(`[handleBanListCommand] Received /banlist command from user ${fromUser.id} in chat ${chatId}.`);

    // Only bot admins can view the ban list
    const isBotAdmin = await isUserAdmin(fromUser.id, env);
    if (!isBotAdmin) {
        const userLinkDisplayName = fromUser.first_name || fromUser.username || "Unknown";
        const userLink = `<a href="tg://user?id=${fromUser.id}"><b>${userLinkDisplayName}</b></a>`;
        await sendMessage(token, chatId, `${userLink} <b>🚫 You don't have permission to use this command.</b>`, 'HTML', null, botKeyValue);
        return;
    }

    if (message.chat.type !== "group" && message.chat.type !== "supergroup") {
        await sendMessage(token, chatId, "This command can only be used in groups.", 'HTML', null, botKeyValue);
        return;
    }

    const bannedUsers = await getBannedUsers(chatId, env);

    if (!bannedUsers || bannedUsers.length === 0) {
        await sendMessage(token, chatId, "<b>📋 Ban List</b>\n\n<i>No banned users in this group.</i>", 'HTML', null, botKeyValue);
        return;
    }

    let responseText = `<b>📋 Ban List</b>\n`;
    responseText += `<b>Total:</b> <code>${bannedUsers.length}</code> users\n`;
    responseText += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    bannedUsers.forEach((user, index) => {
        const userLink = `<a href='tg://user?id=${user.id}'><b>${user.name || "Unknown"}</b></a>`;
        const username = user.username ? `<b>${user.username}</b>` : '<i>None</i>';
        const bannedDate = new Date(user.bannedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        
        responseText += `<b>${index + 1}.</b> ${userLink}\n`;
        responseText += `   <b>🆔 ID:</b> <code>${user.id}</code>\n`;
        responseText += `   <b>🔗 Username:</b> ${username}\n`;
        responseText += `   <b>📅 Banned on:</b> ${bannedDate}\n\n`;
    });

    responseText += `━━━━━━━━━━━━━━━━━━━━`;

    await sendMessage(token, chatId, responseText, 'HTML', null, botKeyValue);
}

/**
 * Handles the /id command, showing the sender's ID or replied user's ID.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleIdCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;

    console.log(`[handleIdCommand] Received /id command from user ${fromUser.id} in chat ${chatId}.`);

    let targetUser = fromUser; 

    if (targetUser) {
        const { text, reply_markup } = await getUserInfoDetails(targetUser, chatId, token, env, botKeyValue); 
        await sendMessage(token, chatId, text, 'HTML', reply_markup, botKeyValue);
    } else {
        await sendMessage(token, chatId, "Could not retrieve your information.", 'HTML', null, botKeyValue);
    }
}

/**
 * Calculates the age of an account from a given creation date up to the current date.
 * Accounts for Thai timezone (UTC+7) for daily rollover.
 * @param {Date} creationDate - The Date object representing the account creation date.
 * @returns {string} - Formatted string like "X years, Y months, Z days".
 */
function calculateAccountAge(creationDate) {
    const now = new Date();

    // Adjust 'now' to Thai timezone (UTC+7) for day rollover
    const thaiTimeOffset = 7 * 60; // 7 hours in minutes
    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); // Convert to UTC
    const thaiDate = new Date(utcNow + (thaiTimeOffset * 60 * 1000)); // Add Thai offset

    // Adjust 'creationDate' to Thai timezone for comparison
    const utcCreation = creationDate.getTime() + (creationDate.getTimezoneOffset() * 60 * 1000);
    const thaiCreationDate = new Date(utcCreation + (thaiTimeOffset * 60 * 1000));

    let years = thaiDate.getFullYear() - thaiCreationDate.getFullYear();
    let months = thaiDate.getMonth() - thaiCreationDate.getMonth();
    let days = thaiDate.getDate() - thaiCreationDate.getDate();

    if (days < 0) {
        months--;
        const prevMonth = new Date(thaiDate.getFullYear(), thaiDate.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    return `${years} years, ${months} months, ${days} days`;
}

/**
 * Estimates the account creation date based on user ID using predefined reference points.
 * Prioritizes fixed dates for known owner IDs.
 * @param {number} userId - The user's Telegram ID.
 * @returns {Date} - Estimated or fixed account creation date.
 */
function estimateAccountCreationDate(userId) {
    // Use fixed date for owner IDs if available
    if (FIXED_ACCOUNT_CREATION_DATES[userId]) {
        console.log(`[estimateAccountCreationDate] Using fixed creation date for owner ID: ${userId}`);
        return FIXED_ACCOUNT_CREATION_DATES[userId];
    }

    // Reference points for Telegram user ID growth (approximate)
    const referencePoints = [
        { id: 100000000, date: new Date(2013, 7, 1) },   // August 1, 2013
        { id: 1273841502, date: new Date(2020, 7, 13) }, // August 13, 2020
        { id: 1500000000, date: new Date(2021, 4, 1) },  // May 1, 2021
        { id: 2000000000, date: new Date(2022, 11, 1) }, // December 1, 2022
        { id: 2500000000, date: new Date(2024, 6, 1) },  // July 1, 2024
    ];

    // Find the closest reference point
    let closestPoint = referencePoints[0];
    let minDiff = Math.abs(userId - closestPoint.id);

    for (let i = 1; i < referencePoints.length; i++) {
        const diff = Math.abs(userId - referencePoints[i].id);
        if (diff < minDiff) {
            minDiff = diff;
            closestPoint = referencePoints[i];
        }
    }

    const averageIdsPerDay = 20000000;
    const idDifference = userId - closestPoint.id;
    const daysDifference = idDifference / averageIdsPerDay;

    const estimatedDate = new Date(closestPoint.date.getTime() + daysDifference * 24 * 60 * 60 * 1000);
    return estimatedDate;
}

/**
 * Handles the /info command (owner/admin only).
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleInfoCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');

    console.log(`[handleInfoCommand] Received /info command from user ${fromUser.id} in chat ${chatId}.`);

    // Check if sender is a BOT ADMIN (hardcoded owner OR dynamic admin)
    const isBotAdmin = await isUserAdmin(fromUser.id, env); 
    if (!isBotAdmin) {
        const userLinkDisplayName = fromUser.first_name || fromUser.username || "Unknown";
        const userLink = `<a href="tg://user?id=${fromUser.id}"><b>${userLinkDisplayName}</b></a>`;
        await sendMessage(token, chatId, `${userLink} <b>🚫 You don't have permission to use this command.</b>`, 'HTML', null, botKeyValue);
        return;
    }

    let targetUser = null;
    let targetChatIdForLink = chatId; 

    if (message.reply_to_message) {
        // Case 1: Reply to a message
        targetUser = message.reply_to_message.from;
        targetChatIdForLink = message.reply_to_message.chat.id;
        console.log(`[handleInfoCommand] Target is replied user: ${targetUser.id}`);
    } else if (args.length > 1) {
        // Case 2: Command with argument (user ID or username)
        const query = args[1].replace('@', ''); 
        let userIdToFetch = null;

        if (!isNaN(parseInt(query))) {
            userIdToFetch = parseInt(query);
            console.log(`[handleInfoCommand] Target is user ID from argument: ${userIdToFetch}`);
        } else {
            console.warn(`[handleInfoCommand] Username resolution via Bot API is limited. Attempting getChatMember for username: ${query}`);
            try {
                const chatMember = await getChatMember(token, chatId, query, botKeyValue); 
                if (chatMember && chatMember.user) {
                    userIdToFetch = chatMember.user.id;
                    console.log(`[handleInfoCommand] Resolved username ${query} to user ID: ${userIdToFetch}`);
                } else {
                    console.warn(`[handleInfoCommand] Could not resolve username ${query} in current chat.`);
                }
            } catch (e) {
                console.error(`[handleInfoCommand] Error fetching user info for ID ${userIdToFetch}: ${e.message}`);
            }
        }

        if (userIdToFetch) {
            try {
                targetUser = await getChatMember(token, chatId, userIdToFetch, botKeyValue);
                if (targetUser) {
                    targetUser = targetUser.user; 
                }
            } catch (e) {
                console.error(`[handleInfoCommand] Error fetching user info for ID ${userIdToFetch}: ${e.message}`);
                await sendMessage(token, chatId, "User information not found or bot does not have access.", 'HTML', null, botKeyValue);
                return;
            }
        } else {
            await sendMessage(token, chatId, "Invalid user ID or username provided. Usage: <code>/info</code>, <code>/info &lt;user_id&gt;</code>, or reply to a message.", 'HTML', null, botKeyValue);
            return;
        }

    } else {
        // Case 3: Command without arguments or reply -> info about the sender
        targetUser = message.from;
        console.log(`[handleInfoCommand] Target is sender: ${targetUser.id}`);
    }

    if (targetUser) {
        const { text, reply_markup } = await getUserInfoDetails(targetUser, targetChatIdForLink, token, env, botKeyValue); 
        await sendMessage(token, chatId, text, 'HTML', reply_markup, botKeyValue);
    } else {
        await sendMessage(token, chatId, "Could not determine target for info command. Please specify a user, reply to a message, or provide a username/ID.", 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /warn command.
 * Allows an admin to issue a warning to a user.
 * Supports replying to a message or providing user ID as argument.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleWarnCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');
    const replyToMessage = message.reply_to_message;

    let targetUserId = null;
    let reason = '';

    if (replyToMessage) {
        targetUserId = replyToMessage.from.id;
        reason = args.slice(1).join(' ').trim();
    } else if (args.length >= 3) {
        targetUserId = parseInt(args[1]);
        reason = args.slice(2).join(' ').trim();
    } else {
        await sendMessage(token, chatId, "Usage: <code>/warn &lt;user_id&gt; &lt;reason&gt;</code> OR reply to a user's message with <code>/warn &lt;reason&gt;</code>.", 'HTML', null, botKeyValue);
        return;
    }

    if (isNaN(targetUserId)) {
        await sendMessage(token, chatId, "User ID must be a number.", 'HTML', null, botKeyValue);
        return;
    }

    if (!reason) {
        await sendMessage(token, chatId, "Please provide a reason for the warning.", 'HTML', null, botKeyValue);
        return;
    }
    
    const botInfo = await getMe(token, botKeyValue);
    if (botInfo && targetUserId === botInfo.id) {
        await sendMessage(token, chatId, "I cannot warn myself.", 'HTML', null, botKeyValue);
        return;
    }

    // Prevent admin from warning other admins
    const isTargetBotAdmin = await isUserAdmin(targetUserId, env);
    if (isTargetBotAdmin) {
        await sendMessage(token, chatId, "I cannot warn a bot administrator.", 'HTML', null, botKeyValue);
        return;
    }

    const success = await setWarning(targetUserId, fromUser.id, reason, env);
    let targetUserDisplayName = `User ${targetUserId}`;
    try {
        const targetUserInfo = await getChatMember(token, chatId, targetUserId, botKeyValue);
        if (targetUserInfo && targetUserInfo.user) {
            targetUserDisplayName = targetUserInfo.user.first_name || targetUserInfo.user.username || targetUserDisplayName;
        }
    } catch (e) {
        console.warn(`[handleWarnCommand] Could not get user info for ID ${targetUserId}. Using default display name.`);
    }

    if (success) {
        const warnings = await getWarnings(targetUserId, env);
        const warningCount = warnings ? warnings.length : 0;
        await sendMessage(token, chatId, `✅ User <a href="tg://user?id=${targetUserId}"><b>${targetUserDisplayName}</b></a> has been warned. (Total warnings: ${warningCount})\nReason: <i>${reason}</i>`, 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, `❌ Failed to warn <a href="tg://user?id=${targetUserId}"><b>${targetUserDisplayName}</b></a>.`, 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /unwarn command.
 * Allows an admin to clear all warnings for a user.
 * Supports providing user ID as argument.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleUnwarnCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');

    let targetUserId = null;

    if (args.length === 2) {
        targetUserId = parseInt(args[1]);
    } else {
        await sendMessage(token, chatId, "Usage: <code>/unwarn &lt;user_id&gt;</code>.", 'HTML', null, botKeyValue);
        return;
    }

    if (isNaN(targetUserId)) {
        await sendMessage(token, chatId, "User ID must be a number.", 'HTML', null, botKeyValue);
        return;
    }
    
    const botInfo = await getMe(token, botKeyValue);
    if (botInfo && targetUserId === botInfo.id) {
        await sendMessage(token, chatId, "I cannot remove my own warnings.", 'HTML', null, botKeyValue);
        return;
    }

    const success = await clearWarnings(targetUserId, env);
    let targetUserDisplayName = `User ${targetUserId}`;
    try {
        const targetUserInfo = await getChatMember(token, chatId, targetUserId, botKeyValue);
        if (targetUserInfo && targetUserInfo.user) {
            targetUserDisplayName = targetUserInfo.user.first_name || targetUserInfo.user.username || targetUserDisplayName;
        }
    } catch (e) {
        console.warn(`[handleUnwarnCommand] Could not get user info for ID ${targetUserId}. Using default display name.`);
    }

    if (success) {
        await sendMessage(token, chatId, `✅ All warnings for <a href="tg://user?id=${targetUserId}"><b>${targetUserDisplayName}</b></a> have been cleared.`, 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, `❌ Failed to clear warnings for <a href="tg://user?id=${targetUserId}"><b>${targetUserDisplayName}</b></a>.`, 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /warnings command.
 * Allows an admin to view all warnings for a user.
 * Supports replying to a message or providing user ID as argument.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleWarningsCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');
    const replyToMessage = message.reply_to_message;

    let targetUserId = null;

    if (replyToMessage) {
        targetUserId = replyToMessage.from.id;
    } else if (args.length === 2) {
        targetUserId = parseInt(args[1]);
    } else {
        await sendMessage(token, chatId, "Usage: <code>/warnings &lt;user_id&gt;</code> OR reply to a user's message with <code>/warnings</code>.", 'HTML', null, botKeyValue);
        return;
    }

    if (isNaN(targetUserId)) {
        await sendMessage(token, chatId, "User ID must be a number.", 'HTML', null, botKeyValue);
        return;
    }

    let targetUserDisplayName = `User ${targetUserId}`;
    try {
        const targetUserInfo = await getChatMember(token, chatId, targetUserId, botKeyValue);
        if (targetUserInfo && targetUserInfo.user) {
            targetUserDisplayName = targetUserInfo.user.first_name || targetUserInfo.user.username || targetUserDisplayName;
        }
    } catch (e) {
        console.warn(`[handleWarningsCommand] Could not get user info for ID ${targetUserId}. Using default display name.`);
    }

    const warnings = await getWarnings(targetUserId, env);

    if (!warnings || warnings.length === 0) {
        await sendMessage(token, chatId, `User <a href="tg://user?id=${targetUserId}"><b>${targetUserDisplayName}</b></a> has no warnings.`, 'HTML', null, botKeyValue);
        return;
    }

    let responseText = `<b>🚨 Warnings for <a href="tg://user?id=${targetUserId}"><b>${targetUserDisplayName}</b></a> (Total: ${warnings.length}):</b>\n\n`;
    warnings.forEach((warn, index) => {
        const warnDate = new Date(warn.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const warnTime = new Date(warn.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        responseText += `<b>${index + 1}.</b> <b>Reason:</b> <i>${warn.reason}</i>\n`;
        responseText += `   <b>Admin:</b> <code>${warn.admin_id}</code>\n`;
        responseText += `   <b>Date:</b> ${warnDate} ${warnTime}\n\n`;
    });

    await sendMessage(token, chatId, responseText, 'HTML', null, botKeyValue);
}

/**
 * Handles the /listadmin command.
 * Allows anyone to view the current list of dynamic admins.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object (must have ADMIN_IDS_KV binding).
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleListAdminCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;

    const dynamicAdminIds = await getAdminIds(env);
    const dynamicAdminNames = await getAdminNames(env);

    let adminListText = "<b>👑 Bot Admins:</b>\n\n";

    // Add hardcoded owners first
    adminListText += "<b>Owners (Hardcoded):</b>\n";
    if (OWNER_ADMIN_IDS.length > 0) {
        for (const ownerId of OWNER_ADMIN_IDS) {
            let ownerName = `User_${ownerId}`;
            const foundName = dynamicAdminNames.find(admin => admin.id === ownerId);
            if (foundName) {
                ownerName = foundName.name;
            } else if (message.from.id === ownerId) {
                ownerName = message.from.first_name || message.from.username || ownerName;
            }
            adminListText += `- <a href='tg://user?id=${ownerId}'><b>${ownerName}</b></a> (<code>${ownerId}</code>)\n`;
        }
    } else {
        adminListText += "  <i>No hardcoded owners defined.</i>\n";
    }

    adminListText += "\n<b>Admins (Dynamically Added):</b>\n";
    if (dynamicAdminIds.length > 0) {
        const nonOwnerAdmins = dynamicAdminNames.filter(admin => !OWNER_ADMIN_IDS.includes(admin.id));
        if (nonOwnerAdmins.length > 0) {
            for (const admin of nonOwnerAdmins) {
                adminListText += `- <a href='tg://user?id=${admin.id}'><b>${admin.name}</b></a> (<code>${admin.id}</code>)\n`;
            }
        } else {
            adminListText += "  <i>No dynamically added admins.</i>\n";
        }
    } else {
        adminListText += "  <i>No dynamically added admins.</i>\n";
    }

    await sendMessage(token, chatId, adminListText, 'HTML', null, botKeyValue);
}
