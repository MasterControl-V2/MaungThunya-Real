// updateHandlers.js
// This file contains functions that handle various Telegram bot updates
// such as chat member updates, spam detection, callback queries, and name changes.

import { 
    sendMessage, 
    getMe, 
    answerCallbackQuery, 
    editMessageText,
    restrictChatMember,
    unbanChatMember,
    unrestrictChatMember,
    getChatMember,
    deleteMessage  // NEW: For auto-delete feature
} from './telegramApiHelpers';
import { 
    isUserAdmin, 
    getUserInfoDetails,
    // NEW: Import ban list function for cleanup on unban
    removeBannedUser
} from './userManagementFunctions';
import { 
    handleRegenerateAddress  // NEW: Import for Re-Generate button
} from './realAddressHandlers';
import { storeChatMessage } from './chatHistoryAndSummarization';
import { BLOCKED_DOMAINS, BLOCKED_APP_IDS, BLOCKED_KEYWORDS_REGEX } from './constants';

// NEW: Auto-delete delay for welcome/name change messages (in milliseconds)
const WELCOME_MESSAGE_DELETE_DELAY_MS = 10000; // 10 seconds


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
 * NEW: Schedules a message for auto-deletion after a delay.
 * Uses ctx.waitUntil() to ensure the deletion happens even after the Worker response.
 * @param {object} ctx - Cloudflare context object with waitUntil.
 * @param {string} token - Telegram Bot Token.
 * @param {number} chatId - Chat ID where the message was sent.
 * @param {number} messageId - Message ID to delete.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @param {number} delayMs - Delay in milliseconds before deletion.
 */
function scheduleMessageDeletion(ctx, token, chatId, messageId, botKeyValue, delayMs) {
    if (!ctx || typeof ctx.waitUntil !== 'function') {
        console.warn("[scheduleMessageDeletion] ctx.waitUntil not available. Message will NOT be auto-deleted.");
        return;
    }
    
    if (!messageId) {
        console.warn("[scheduleMessageDeletion] messageId is missing. Cannot schedule deletion.");
        return;
    }
    
    console.log(`[scheduleMessageDeletion] Scheduling deletion of message ${messageId} in chat ${chatId} after ${delayMs}ms.`);
    
    ctx.waitUntil(
        (async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                await deleteMessage(token, chatId, messageId, botKeyValue);
                console.log(`[scheduleMessageDeletion] Successfully deleted message ${messageId} from chat ${chatId}.`);
            } catch (error) {
                console.error(`[scheduleMessageDeletion] Failed to delete message ${messageId}:`, error);
            }
        })()
    );
}


/**
 * Handles updates when a chat member's status changes (e.g., join, leave, name change).
 * UPDATED: Welcome/Name Change messages are auto-deleted after 15 seconds.
 * @param {object} chatMemberUpdate - Telegram ChatMemberUpdated object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @param {object} ctx - Cloudflare context object (for waitUntil).
 */
export async function handleChatMemberUpdate(chatMemberUpdate, token, env, botKeyValue, ctx) {
    const newChatMember = chatMemberUpdate.new_chat_member;
    const chat = chatMemberUpdate.chat;
    const userId = newChatMember.user.id;
    const chatId = chat.id;
    console.log(`[handleChatMemberUpdate] Received update for user ${userId} in chat ${chatId}. Status: ${newChatMember.status}`);

    if (!newChatMember || !newChatMember.user) { 
        console.log("[handleChatMemberUpdate] newChatMember or user is null. Returning."); 
        return; 
    }
    const user = newChatMember.user;
    let currentFullName = user.first_name || ''; 
    if (user.last_name) { 
        currentFullName += (currentFullName ? ' ' : '') + user.last_name; 
    } 
    currentFullName = currentFullName.trim() || null;
    const currentUsername = user.username ? `@${user.username}` : null;

    let userDataRaw = null;
    if (env.USER_DATA) { 
        userDataRaw = await env.USER_DATA.get(userId.toString(), { type: 'json' }); 
    } else { 
        console.warn("[handleChatMemberUpdate] USER_DATA KV namespace is not bound. Cannot retrieve user data."); 
    }
    let userData = { full_names: [], usernames: [] };
    if (userDataRaw) {
        if (Array.isArray(userDataRaw.full_names)) { userData.full_names = userDataRaw.full_names; }
        if (Array.isArray(userDataRaw.usernames)) { userData.usernames = Array.from(new Set([...userData.usernames, currentUsername].filter(Boolean))); }
    }
    const oldFullNames = userData.full_names;
    const oldUsernames = userData.usernames;

    if (newChatMember.status === "member" || newChatMember.status === "administrator") {
        console.log(`[handleChatMemberUpdate] User ${userId} joined/rejoined/promoted.`);
        let messageText = ""; 
        const userLinkDisplayName = currentFullName || "အမည်မရှိသူ"; 
        const userLink = `<a href='tg://user?id=${userId}'><b>${userLinkDisplayName}</b></a>`;
        if (oldFullNames.length === 0 && oldUsernames.length === 0) {
            console.log(`[handleChatMemberUpdate] New member detected: ${userLinkDisplayName}.`);
            messageText = ( "<b>┏━━━━━━━━━━━━━━━━━━┓</b>\n" + "    <b>🔔 Name Change Detected</b> \n" + "<b>┗━━━━━━━━━━━━━━━━━━┛</b>\n" + `<b>🌟 ${chat.title} Group မှ ကြိုဆိုပါတယ်!</b>\n\n` + "<b>🆕 မန်ဘာသစ်ဝင်ရောက်လာသူ!</b> \n" + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + "<b>👤 User:</b> " + userLink + "\n" + `<b>🆔 ID: ${userId}</b>\n` + `<b>🔗 Username: ${currentUsername || "မရှိပါ"}</b>\n` + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + `<b>🆕 New Name:</b> <b>${userLinkDisplayName}</b>\n` + `<b>🔄 New Username: ${currentUsername || "မရှိပါ"}</b>\n\n` + "<b>💖 ThankYou For All 💖</b>\n" + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + "<b>⚠️ Note:</b> Name/username changes are tracked for security. If you change your name frequently, it might be flagged." );
        } else {
            console.log(`[handleChatMemberUpdate] Returning member detected: ${userLinkDisplayName}.`);
            const oldNamesStr = oldFullNames.length > 0 ? oldFullNames.map(name => `<b>${name || "အမည်မရှိပါ"}</b>`).join(", ") : "<b>မရှိပါ</b>";
            const oldUsernamesStr = oldUsernames.length > 0 ? oldUsernames.map(uname => `<b>${uname || "မရှိပါ"}</b>`).join(", ") : "<b>မရှိပါ</b>";
            messageText = ( "<b>┏━━━━━━━━━━━━━━━━━━┓</b>\n" + "    <b>🔔 Name Change Detected</b> \n" + "<b>┗━━━━━━━━━━━━━━━━━━┛</b>\n" + `<b>🌟 ${chat.title} Group မှ ကြိုဆိုပါတယ်!</b>\n\n` + "<b>🆕 မန်ဘာဟောင်း ပြန်လည်ဝင်ရောက်လာသူ!</b> \n" + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + "<b>👤 User:</b> " + userLink + "\n" + `<b>🆔 ID: ${userId}</b>\n` + `<b>🔗 Username: ${currentUsername || "မရှိပါ"}</b>\n` + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + `<b>📛 Old Name(s):</b> {${oldNamesStr}}\n` + `<b>🔗 Old Username(s): ${oldUsernamesStr}</b>\n` + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + `<b>🆕 New Name:</b> <b>${userLinkDisplayName}</b>\n` + `<b>🔄 New Username: ${currentUsername || "မရှိပါ"}</b>\n\n` + "<b>💖 ThankYou For All 💖</b>\n" + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + "<b>⚠️ Note:</b> Name/username changes are tracked for security. If you change your name frequently, it might be flagged." );
        }
        let namesToStore = new Set(userData.full_names); 
        let usernamesToStore = new Set(userData.usernames);
        if (currentFullName) namesToStore.add(currentFullName); 
        if (currentUsername) usernamesToStore.add(currentUsername);
        if (env.USER_DATA) { 
            await env.USER_DATA.put(userId.toString(), JSON.stringify({ full_names: Array.from(namesToStore), usernames: Array.from(usernamesToStore) })); 
            console.log(`[handleChatMemberUpdate] User data stored for ${userId}.`); 
        }
        
        // NEW: Send message and schedule auto-deletion after 15 seconds
        const sendResult = await sendMessage(token, chatId, messageText, 'HTML', null, botKeyValue);
        const sentMessageId = sendResult && sendResult.result ? sendResult.result.message_id : null;
        
        if (sentMessageId) {
            scheduleMessageDeletion(ctx, token, chatId, sentMessageId, botKeyValue, WELCOME_MESSAGE_DELETE_DELAY_MS);
        } else {
            console.warn("[handleChatMemberUpdate] Could not retrieve message_id from sendMessage response. Auto-delete skipped.");
        }
        
    } else if (newChatMember.status === "left" || newChatMember.status === "kicked") {
        console.log(`[handleChatMemberUpdate] User ${userId} left/kicked.`);
        const leavingUser = newChatMember.user;
        let leavingFullName = leavingUser.first_name || '';
        if (leavingUser.last_name) {
            leavingFullName += (leavingFullName ? ' ' : '') + leavingUser.last_name;
        }
        leavingFullName = leavingFullName.trim() || "အမည်မသိအသုံးပြုသူ";

        const userProfileLink = `<a href='tg://user?id=${userId}'><b>${leavingFullName}</b></a>`;

        const exitMessageText = (
            "<b>┏━━━━━━━━━━━━━━━┓</b>\n" +
            "   <b>Group ! မှ ထွက်သွားသူ</b> \n" + 
            "           <b>" + userProfileLink + "</b>\n" + 
            "          <b>" + userId + "</b>\n" + 
            "           <b>BYE BYE !!! 🤭</b>\n" + 
            "<b>┗━━━━━━━━━━━━━━━┛</b>"
        );
        // Leave message also auto-deleted after 15 seconds
        const sendResult = await sendMessage(token, chatId, exitMessageText, 'HTML', null, botKeyValue);
        const sentMessageId = sendResult && sendResult.result ? sendResult.result.message_id : null;
        
        if (sentMessageId) {
            scheduleMessageDeletion(ctx, token, chatId, sentMessageId, botKeyValue, WELCOME_MESSAGE_DELETE_DELAY_MS);
        }
    }
}

/**
 * handleSpamDetectionAndMute function detects blocked links or keywords and mutes the user.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<boolean>} - True if spam was detected and user was muted, false otherwise.
 */
export async function handleSpamDetectionAndMute(message, token, botKeyValue) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const messageText = message.text || '';
    const userDisplayName = message.from.first_name || message.from.username || "အမည်မသိအသုံးပြုသူ";
    console.log(`[handleSpamDetectionAndMute] Running spam detection for user ${userId} in chat ${chatId}. Message: "${messageText.substring(0, 50)}..."`);
    let isSpamDetected = false;
    let detectedReason = "";

    const lowerText = messageText.toLowerCase();

    for (const blockedDomain of BLOCKED_DOMAINS) {
        if (lowerText.includes(blockedDomain.toLowerCase())) {
            isSpamDetected = true;
            detectedReason = `ခွင့်မပြုသော Link (${blockedDomain})`;
            console.log(`[handleSpamDetectionAndMute] SPAM DETECTED by BLOCKED_DOMAINS: ${detectedReason}`);
            break;
        }
    }

    if (!isSpamDetected && (lowerText.includes("play.google.com/store/apps/details?id=") || lowerText.includes("apps.apple.com/"))) {
        let appId = null;
        const playStoreMatch = messageText.match(/play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9\._-]+)/i);
        const appStoreMatch = messageText.match(/apps\.apple\.com\/[a-z]{2}\/app\/[a-z0-9-]+\/id(\d+)/i);

        if (playStoreMatch && playStoreMatch[1]) {
            appId = playStoreMatch[1].toLowerCase();
        } else if (appStoreMatch && appStoreMatch[1]) {
            appId = `apple_id_${appStoreMatch[1].toLowerCase()}`;
        }

        if (appId) {
            console.log(`[handleSpamDetectionAndMute] Detected Play Store/App Store link with App ID: ${appId}`);
            if (BLOCKED_APP_IDS.includes(appId)) {
                isSpamDetected = true;
                detectedReason = `ခွင့်မပြုသော App Store Link (App ID: ${appId})`;
                console.log(`[handleSpamDetectionAndMute] SPAM DETECTED by BLOCKED_APP_IDS: ${detectedReason}`);
            } else {
                console.log(`[handleSpamDetectionAndMute] Play Store/App Store link is NOT a blocked app. Allowing: ${appId}`);
            }
        } else {
            console.log(`[handleSpamDetectionAndMute] Play Store/App Store link found, but could not extract valid App ID. Allowing.`);
        }
    }

    if (!isSpamDetected) {
        for (const regex of BLOCKED_KEYWORDS_REGEX) {
            if (regex.test(messageText)) {
                isSpamDetected = true;
                const matchedKeyword = messageText.match(regex)[0];
                detectedReason = `ခွင့်မပြုသော စာသား ('${matchedKeyword}')`;
                console.log(`[handleSpamDetectionAndMute] SPAM DETECTED by Keyword: ${detectedReason}`);
                break;
            }
        }
    }

    if (isSpamDetected) {
        console.log(`[handleSpamDetectionAndMute] SPAM DETECTED for user ${userId}. Attempting to delete message and mute user.`);
        try {
            // Import deleteMessage and restrictChatMember directly from telegramApiHelpers
            const { deleteMessage, restrictChatMember } = await import('./telegramApiHelpers'); 
            await deleteMessage(token, chatId, message.message_id, botKeyValue);

            const success = await restrictChatMember(token, chatId, userId, 0, botKeyValue);
            if (success) {
                const userLink = `<a href='tg://user?id=${userId}'><b>${userDisplayName}</b></a>`;
                const reply_markup = { inline_keyboard: [[{ text: "✅ Unmute", callback_data: `unmute_${userId}_${chatId}` }]] };
                await sendMessage(token, chatId, `🚨 ${userLink} သည် ${detectedReason} ပို့၍ အချိန်အကန့်အသတ်မရှိ စာပို့ခွင့် ပိတ်ခံရပါသည်။`, 'HTML', reply_markup, botKeyValue);
                console.log(`[handleSpamDetectionAndMute] User ${userId} muted successfully.`);
            } else { 
                await sendMessage(token, chatId, `❌ ${userDisplayName} ကို Mute လုပ်မရပါ။ Bot ၏ Permissions ကို စစ်ဆေးပါ။`, 'HTML', null, botKeyValue); 
                console.error(`[handleSpamDetectionAndMute] Failed to mute user ${userId}.`); 
            }
            return true;
        } catch (error) { 
            console.error("[handleSpamDetectionAndMute] Error during spam detection and mute execution:", error); 
            return false; 
        }
    }
    console.log(`[handleSpamDetectionAndMute] No spam detected for user ${userId}.`); 
    return false;
}

/**
 * Handles incoming callback queries from inline keyboards.
 * UPDATED: Handles 'regen_address' callback for Re-Generate button.
 * UPDATED: When 'unban' action is performed, the user is also removed from the ban list.
 * @param {object} callbackQuery - Telegram CallbackQuery object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleCallbackQuery(callbackQuery, token, env, botKeyValue) {
    const data = callbackQuery.data;
    const fromUser = callbackQuery.from;
    const messageId = callbackQuery.message.message_id;

    console.log(`[handleCallbackQuery] Received callback query. Data: "${data}", From User: ${fromUser.id}.`);
    
    // ============================================================
    // NEW: Handle 'regen_address' callback for Re-Generate button
    // Format: regen_address_<COUNTRY_CODE>
    // ============================================================
    if (data.startsWith('regen_address_')) {
        const countryCode = data.substring('regen_address_'.length);
        console.log(`[handleCallbackQuery] Re-Generate requested for country: ${countryCode}`);
        await handleRegenerateAddress(callbackQuery, token, env, botKeyValue, countryCode, messageId);
        return;
    }
    // ============================================================
    // END: regen_address handling
    // ============================================================
    
    const parts = data.split('_');
    // Handle copyid callback data separately
    if (parts[0] === 'copyid' && parts.length === 2) {
        const idToCopy = parts[1];
        await answerCallbackQuery(token, callbackQuery.id, `ID: ${idToCopy} ကို ကူးယူပြီးပါပြီ။`, false, botKeyValue);
        return;
    }

    if (parts[0] === 'copyusername' && parts.length === 2) {
        const usernameToCopy = parts[1];
        await answerCallbackQuery(token, callbackQuery.id, `Username: @${usernameToCopy} ကို ကူးယူပြီးပါပြီ။`, false, botKeyValue);
        return;
    }

    if (parts.length < 3) {
        console.error(`[handleCallbackQuery] Invalid callback data format: ${data}`);
        await answerCallbackQuery(token, callbackQuery.id, "အချက်အလက် မှားယွင်းနေပါသည်။", true, botKeyValue);
        return;
    }

    const action = parts[0];
    const targetUserId = parseInt(parts[1]);
    const chatId = parseInt(parts[2]);

    console.log(`[handleCallbackQuery] Parsed - Action: ${action}, Target User ID: ${targetUserId}, Chat ID: ${chatId}`);

    await answerCallbackQuery(token, callbackQuery.id, "တောင်းဆိုမှုကို ဆောင်ရွက်နေပါသည်။", false, botKeyValue);

    // This check is for general admin actions (unmute/unban)
    const isSenderBotAdmin = await isUserAdmin(fromUser.id, env);
    
    if (!isSenderBotAdmin) {
        await answerCallbackQuery(token, callbackQuery.id, "ဤခလုတ်ကို အသုံးပြုရန် ခွင့်ပြုချက်မရှိပါ။", true, botKeyValue);
        console.warn(`[handleCallbackQuery] User ${fromUser.id} is not authorized to use action '${action}'.`);
        return;
    }

    let success = false;
    let userName = targetUserId;

    try {
        const userInfo = await getChatMember(token, chatId, targetUserId, botKeyValue);
        if (userInfo && userInfo.user) {
            userName = userInfo.user.first_name || userInfo.user.username || targetUserId;
            console.log(`[handleCallbackQuery] Target user info retrieved: ${userName} (${targetUserId})`);
        } else {
            console.warn(`[handleCallbackQuery] Could not retrieve info for target user ${targetUserId}.`);
        }

        if (action === 'unmute') {
            console.log(`[handleCallbackQuery] Attempting to 'unmute' user ${targetUserId}.`);
            success = await unrestrictChatMember(token, chatId, targetUserId, 0, botKeyValue);
            console.log(`[handleCallbackQuery] unrestrictChatMember returned success: ${success}`);
        } else if (action === 'unban') {
            console.log(`[handleCallbackQuery] Attempting to 'unban' user ${targetUserId}.`);
            success = await unbanChatMember(token, chatId, targetUserId, botKeyValue);
            console.log(`[handleCallbackQuery] unbanChatMember returned success: ${success}`);
            
            // NEW: If unban was successful, remove user from ban list KV
            if (success) {
                const removeSuccess = await removeBannedUser(chatId, targetUserId, env);
                if (removeSuccess) {
                    console.log(`[handleCallbackQuery] User ${targetUserId} removed from ban list for chat ${chatId}.`);
                } else {
                    console.warn(`[handleCallbackQuery] Failed to remove user ${targetUserId} from ban list.`);
                }
            }
        } else {
            console.warn(`[handleCallbackQuery] Unhandled action: ${action}`);
            await answerCallbackQuery(token, callbackQuery.id, "မသိသော လုပ်ဆောင်ချက်ပါ။", true, botKeyValue);
            return;
        }

        if (success) {
            console.log(`[handleCallbackQuery] Action '${action}' successful for user ${targetUserId}. Editing message.`);
            const actionVerb = action === 'unmute' ? 'Unmute' : 'Unban';
            await editMessageText(token, chatId, messageId, `✅ User <b>${userName}</b> (${targetUserId}) ကို ${actionVerb} ပြုလုပ်ပြီးပါပြီ။`, 'HTML', null, botKeyValue);
        } else {
            console.error(`[handleCallbackQuery] Action '${action}' FAILED for user ${targetUserId}. Sending error message.`);
            const actionVerb = action === 'unmute' ? 'Unmute' : 'Unban';
            await editMessageText(token, chatId, messageId, `❌ User <b>${userName}</b> (${targetUserId}) ကို ${actionVerb} ပြုလုပ်မရပါ။ Bot ၏ Permissions ကို စစ်ဆေးပါ။`, 'HTML', null, botKeyValue);
            await answerCallbackQuery(token, callbackQuery.id, `မမျှော်လင့်သော ပြဿနာတစ်ခု ကြုံတွေ့ခဲ့ရပါသည်။`, true, botKeyValue);
        }
    } catch (error) {
        console.error(`[handleCallbackQuery] Unexpected error processing callback query for user ${targetUserId}:`, error);
        await editMessageText(token, chatId, messageId, `User <b>${userName}</b> (${targetUserId}) အတွက် တောင်းဆိုမှုကို ဆောင်ရွက်နေစဉ် မမျှော်လင့်သော ပြဿနာတစ်ခု ကြုံတွေ့ခဲ့ရပါသည်။`, 'HTML', null, botKeyValue);
        await answerCallbackQuery(token, callbackQuery.id, `မမျှော်လင့်သော ပြဿနာတစ်ခု ကြုံတွေ့ခဲ့ရပါသည်။`, true, botKeyValue);
    }
}

/**
 * Handles name change tracking for users sending messages.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleMessageUpdateForNameChange(message, token, env, botKeyValue) {
    const userId = message.from.id;
    const chatId = message.chat.id;
    console.log(`[handleMessageUpdateForNameChange] Checking name change for user ${userId}.`);
    if (!env.USER_DATA) { console.warn("[handleMessageUpdateForNameChange] USER_DATA KV namespace is not bound. Cannot check name data."); return; }
    let userDataRaw = await env.USER_DATA.get(userId.toString(), { type: 'json' });
    let oldFullNames = []; 
    let oldUsernames = [];
    if (userDataRaw) {
        if (Array.isArray(userDataRaw.full_names)) { oldFullNames = userDataRaw.full_names; }
        if (Array.isArray(userDataRaw.usernames)) { oldUsernames = userDataRaw.usernames; }
    }
    let currentFullName = message.from.first_name || ''; 
    if (message.from.last_name) { 
        currentFullName += (currentFullName ? ' ' : '') + message.from.last_name; 
    } 
    currentFullName = currentFullName.trim() || null;
    const currentUsername = message.from.username ? `@${message.from.username}` : null;
    const oldNamesSet = new Set(oldFullNames.filter(name => name !== null && name !== ''));
    const oldUsernamesSet = new Set(oldUsernames.filter(uname => uname !== null && uname !== ''));
    const isNameChanged = currentFullName && !oldNamesSet.has(currentFullName);
    const isUsernameChanged = currentUsername && !oldUsernamesSet.has(currentUsername);

    if (oldFullNames.length === 0 && oldUsernames.length === 0) {
        const namesToStore = new Set(); 
        const usernamesToStore = new Set();
        if (currentFullName) namesToStore.add(currentFullName); 
        if (currentUsername) usernamesToStore.add(currentUsername);
        await env.USER_DATA.put(userId.toString(), JSON.stringify({ full_names: Array.from(namesToStore), usernames: Array.from(usernamesToStore) }));
        console.log(`[handleMessageUpdateForNameChange] Initial name data stored for ${userId}.`); 
        return;
    }
    if (isNameChanged || isUsernameChanged) {
        console.log(`[handleMessageUpdateForNameChange] Name or username changed for user ${userId}.`);
        const userLinkDisplayName = currentFullName || "အမည်မရှိသူ"; 
        const userLink = `<a href='tg://user?id=${userId}'><b>${userLinkDisplayName}</b></a>`;
        const oldNamesDisplay = oldFullNames.length > 0 ? oldFullNames.map(name => `<b>${name || "အမည်မရှိပါ"}</b>`).join(", ") : "<b>မရှိပါ</b>";
        const oldUsernamesDisplay = oldUsernames.length > 0 ? oldUsernames.map(uname => `<b>${uname || "မရှိပါ"}</b>`).join(", ") : "<b>မရှိပါ</b>";
        const messageText = ( "<b>┏━━━━━━━━━━━━━━━━━━┓</b>\n" + "    <b>📌Group Member Update!</b>\n" + "<b>┗━━━━━━━━━━━━━━━━━━┛</b>\n\n" + `<b>👤 User:</b> ${userLink}\n\n` + `<b>🆔 ID: ${userId}</b>\n` + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + `<b>📛 Old Name(s):</b> {${oldNamesDisplay}}\n\n` + `<b>🔗 Old Username(s): ${oldUsernamesDisplay}</b>\n` + "<b>━━━━━━━━━━━━━━━━━━━━</b>\n" + `<b>🆕 New Name:</b> ${currentFullName || "မရှိပါ"}\n\n` + `<b>🔄 New Username: ${currentUsername || "မရှိပါ"}</b>\n` + "<b>━━━━━━━━━━━━━━━━━━━━</b>" );
        await sendMessage(token, chatId, messageText, 'HTML', null, botKeyValue);
        const updatedNames = new Set(oldFullNames); 
        const updatedUsernames = new Set(oldUsernames);
        if (currentFullName) updatedNames.add(currentFullName); 
        if (currentUsername) updatedUsernames.add(currentUsername);
        await env.USER_DATA.put(userId.toString(), JSON.stringify({ full_names: Array.from(updatedNames), usernames: Array.from(updatedUsernames) }));
        console.log(`[handleMessageUpdateForNameChange] User data updated for ${userId}.`);
    } else {
        const namesToStore = new Set(oldFullNames); 
        const usernamesToStore = new Set(oldUsernames);
        if (currentFullName) namesToStore.add(currentFullName); 
        if (currentUsername) usernamesToStore.add(currentUsername);
        const currentDataString = JSON.stringify({ full_names: Array.from(namesToStore).sort(), usernames: Array.from(usernamesToStore).sort() });
        const existingDataString = JSON.stringify({ full_names: oldFullNames.sort(), usernames: oldUsernames.sort() });
        if (currentDataString !== existingDataString) {
            console.log(`[handleMessageUpdateForNameChange] Updating user data for ${userId} (no visible change, but data structure updated).`);
            await env.USER_DATA.put(userId.toString(), JSON.stringify({ full_names: Array.from(namesToStore), usernames: Array.from(usernamesToStore) }));
        }
    }
}
