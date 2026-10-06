// userManagementFunctions.js
// This file contains functions related to user administration and data management.

import { sendMessage, getMe, getChatMember } from './telegramApiHelpers'; 
import { TELEGRAM_API, FIXED_ACCOUNT_CREATION_DATES, OWNER_ADMIN_IDS } from './constants'; 

/**
 * Stores a list of admin IDs in the ADMIN_IDS_KV namespace.
 * @param {Array<number>} adminIds - An array of admin user IDs.
 * @param {object} env - The Cloudflare environment object (must have ADMIN_IDS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setAdminIds(adminIds, env) {
    if (!env.ADMIN_IDS_KV) {
        console.error("[setAdminIds] ADMIN_IDS_KV KV namespace is not bound. Cannot store admin IDs.");
        return false;
    }
    try {
        // Store as a JSON string
        await env.ADMIN_IDS_KV.put("owner_admin_ids", JSON.stringify(adminIds));
        console.log(`[setAdminIds] Admin IDs stored successfully: ${JSON.stringify(adminIds)}`);
        return true;
    } catch (error) {
        console.error("[setAdminIds] Error storing admin IDs:", error);
        return false;
    }
}

/**
 * Retrieves the list of admin IDs from the ADMIN_IDS_KV namespace.
 * @param {object} env - The Cloudflare environment object (must have ADMIN_IDS_KV binding).
 * @returns {Promise<Array<number>>} - An array of admin user IDs, or an empty array if not found or error.
 */
export async function getAdminIds(env) {
    if (!env.ADMIN_IDS_KV) {
        console.warn("[getAdminIds] ADMIN_IDS_KV KV namespace is not bound. Cannot retrieve admin IDs.");
        return [];
    }
    try {
        const adminIdsRaw = await env.ADMIN_IDS_KV.get("owner_admin_ids");
        if (adminIdsRaw) {
            const adminIds = JSON.parse(adminIdsRaw);
            console.log(`[getAdminIds] Retrieved admin IDs: ${JSON.stringify(adminIds)}`);
            return Array.isArray(adminIds) ? adminIds : [];
        }
        console.log("[getAdminIds] No admin IDs found in KV. Returning empty array.");
        return [];
    } catch (error) {
        console.error("[getAdminIds] Error retrieving admin IDs:", error);
        return [];
    }
}

/**
 * Stores a list of admin names (with IDs) in the ADMIN_IDS_KV namespace.
 * This is to store display names associated with admin IDs.
 * @param {Array<object>} adminNames - An array of objects: [{ id: number, name: string }].
 * @param {object} env - The Cloudflare environment object (must have ADMIN_IDS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setAdminNames(adminNames, env) {
    if (!env.ADMIN_IDS_KV) { // Using the same KV for names and IDs
        console.error("[setAdminNames] ADMIN_IDS_KV KV namespace is not bound. Cannot store admin names.");
        return false;
    }
    try {
        await env.ADMIN_IDS_KV.put("owner_admin_names", JSON.stringify(adminNames));
        console.log(`[setAdminNames] Admin names stored successfully: ${JSON.stringify(adminNames)}`);
        return true;
    } catch (error) {
        console.error("[setAdminNames] Error storing admin names:", error);
        return false;
    }
}

/**
 * Retrieves the list of admin names (with IDs) from the ADMIN_IDS_KV namespace.
 * @param {object} env - The Cloudflare environment object (must have ADMIN_IDS_KV binding).
 * @returns {Promise<Array<object>>} - An array of objects: [{ id: number, name: string }], or empty array.
 */
export async function getAdminNames(env) {
    if (!env.ADMIN_IDS_KV) {
        console.warn("[getAdminNames] ADMIN_IDS_KV KV namespace is not bound. Cannot retrieve admin names.");
        return [];
    }
    try {
        const adminNamesRaw = await env.ADMIN_IDS_KV.get("owner_admin_names");
        if (adminNamesRaw) {
            const adminNames = JSON.parse(adminNamesRaw);
            console.log(`[getAdminNames] Retrieved admin names: ${JSON.stringify(adminNames)}`);
            return Array.isArray(adminNames) ? adminNames : [];
        }
        console.log("[getAdminNames] No admin names found in KV. Returning empty array.");
        return [];
    } catch (error) {
        console.error("[getAdminNames] Error retrieving admin names:", error);
        return [];
    }
}

/**
 * Checks if a user is an admin for the bot (either hardcoded owner or dynamic admin).
 * This function NO LONGER checks for general Telegram chat administrator status.
 * @param {number} userId - The ID of the user to check.
 * @param {object} env - Cloudflare Environment object (must have ADMIN_IDS_KV binding).
 * @returns {Promise<boolean>} - True if the user is a bot admin, false otherwise.
 */
export async function isUserAdmin(userId, env) { 
    console.log(`[isUserAdmin] Checking bot admin status for user ${userId}.`);
    
    // Check hardcoded owners first
    if (OWNER_ADMIN_IDS.includes(userId)) {
        console.log(`[isUserAdmin] User ${userId} is a hardcoded owner/admin.`);
        return true;
    }

    // Check dynamic admins from KV
    const dynamicAdminIds = await getAdminIds(env);
    if (dynamicAdminIds.includes(userId)) {
        console.log(`[isUserAdmin] User ${userId} is a dynamic admin.`);
        return true;
    }

    console.log(`[isUserAdmin] User ${userId} is NOT a bot admin.`);
    return false;
}

/**
 * Checks if a user is a hardcoded owner.
 * @param {number} userId - The ID of the user to check.
 * @returns {boolean} - True if the user is a hardcoded owner, false otherwise.
 */
export function isUserOwner(userId) {
    return OWNER_ADMIN_IDS.includes(userId);
}


/**
 * Handles the /addadmin command.
 * Allows an owner to add a new admin ID to the dynamic list.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object (must have ADMIN_IDS_KV binding).
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleAddAdminCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');

    // Owner check is now done in _middleware.js before calling this function
    // No need to check OWNER_ADMIN_IDS here.

    if (args.length < 2) {
        await sendMessage(token, chatId, "အသုံးပြုပုံ: <code>/addadmin &lt;user_id&gt;|&lt;name&gt;</code>", 'HTML', null, botKeyValue);
        return;
    }

    const input = args.slice(1).join(' ');
    const parts = input.split('|').map(p => p.trim());

    if (parts.length < 2) {
        await sendMessage(token, chatId, "အသုံးပြုပုံ: <code>/addadmin &lt;user_id&gt;|&lt;name&gt;</code> (ဥပမာ: <code>/addadmin 1234567890|John Doe</code>)", 'HTML', null, botKeyValue);
        return;
    }

    const userIdToAdd = parseInt(parts[0]);
    const adminName = parts[1];

    if (isNaN(userIdToAdd)) {
        await sendMessage(token, chatId, "User ID သည် ဂဏန်းဖြစ်ရပါမည်။", 'HTML', null, botKeyValue);
        return;
    }

    let currentAdminIds = await getAdminIds(env);
    let currentAdminNames = await getAdminNames(env);

    if (currentAdminIds.includes(userIdToAdd)) {
        await sendMessage(token, chatId, `User <b>${adminName}</b> (<code>${userIdToAdd}</code>) သည် Admin စာရင်းတွင် ရှိပြီးသား ဖြစ်ပါသည်။`, 'HTML', null, botKeyValue);
        return;
    }

    // Prevent adding hardcoded owners via /addadmin if they are already hardcoded
    if (OWNER_ADMIN_IDS.includes(userIdToAdd)) {
        await sendMessage(token, chatId, `User <b>${adminName}</b> (<code>${userIdToAdd}</code>) သည် Bot ၏ Owner ဖြစ်နေသောကြောင့် ထည့်သွင်း၍ မရပါ။`, 'HTML', null, botKeyValue);
        return;
    }


    currentAdminIds.push(userIdToAdd);
    currentAdminNames.push({ id: userIdToAdd, name: adminName });

    const successIds = await setAdminIds(currentAdminIds, env);
    const successNames = await setAdminNames(currentAdminNames, env);

    if (successIds && successNames) {
        await sendMessage(token, chatId, `✅ User <b>${adminName}</b> (<code>${userIdToAdd}</code>) ကို Admin အဖြစ် ထည့်သွင်းလိုက်ပါပြီ။`, 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, `❌ User <b>${adminName}</b> (<code>${userIdToAdd}</code>) ကို Admin အဖြစ် ထည့်သွင်း၍ မရပါ။`, 'HTML', null, botKeyValue);
    }
}

/**
 * Handles the /deleteadmin command.
 * Allows an owner to remove an admin ID from the dynamic list.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object (must have ADMIN_IDS_KV binding).
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleDeleteAdminCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const args = message.text.split(' ');

    // Owner check is now done in _middleware.js before calling this function
    // No need to check OWNER_ADMIN_IDS here.

    if (args.length < 2) {
        await sendMessage(token, chatId, "အသုံးပြုပုံ: <code>/deleteadmin &lt;user_id&gt;</code> (သို့) user ၏ message ကို reply လုပ်ပြီး <code>/deleteadmin</code>.", 'HTML', null, botKeyValue);
        return;
    }

    const userIdToDelete = parseInt(args[1]);

    if (isNaN(userIdToDelete)) {
        await sendMessage(token, chatId, "User ID သည် ဂဏန်းဖြစ်ရပါမည်။", 'HTML', null, botKeyValue);
        return;
    }

    let currentAdminIds = await getAdminIds(env);
    let currentAdminNames = await getAdminNames(env);

    if (!currentAdminIds.includes(userIdToDelete)) {
        await sendMessage(token, chatId, `User ID <code>${userIdToDelete}</code> သည် Admin စာရင်းတွင် မရှိပါ။`, 'HTML', null, botKeyValue);
        return;
    }

    // Prevent hardcoded owner from being deleted via /deleteadmin
    if (OWNER_ADMIN_IDS.includes(userIdToDelete)) { 
        await sendMessage(token, chatId, "Bot Owner ကို Admin စာရင်းမှ ဖယ်ရှား၍ မရပါ။", 'HTML', null, botKeyValue);
        return;
    }
    
    // Prevent the user who executed the command from deleting themselves if they are a dynamic admin
    if (fromUser.id === userIdToDelete) {
        await sendMessage(token, chatId, "သင်ကိုယ်တိုင် Admin စာရင်းမှ ဖယ်ရှား၍ မရပါ။", 'HTML', null, botKeyValue);
        return;
    }

    const updatedAdminIds = currentAdminIds.filter(id => id !== userIdToDelete);
    const updatedAdminNames = currentAdminNames.filter(admin => admin.id !== userIdToDelete);

    const successIds = await setAdminIds(updatedAdminIds, env);
    const successNames = await setAdminNames(updatedAdminNames, env);

    if (successIds && successNames) {
        await sendMessage(token, chatId, `✅ User ID <code>${userIdToDelete}</code> ကို Admin စာရင်းမှ ဖယ်ရှားလိုက်ပါပြီ။`, 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, `❌ User ID <code>${userIdToDelete}</code> ကို Admin အဖြစ် ထည့်သွင်း၍ မရပါ။`, 'HTML', null, botKeyValue);
    }
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
            // Try to find name from dynamicAdminNames if already fetched or from message sender if available
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


/**
 * Deletes user data from the USER_DATA KV namespace.
 * @param {number} userId - The ID of the user whose data to delete.
 * @param {object} env - The Cloudflare environment object (must have USER_DATA binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function deleteUserData(userId, env) {
    if (!env.USER_DATA) { console.warn("[deleteUserData] USER_DATA KV namespace is not bound. Cannot delete user data."); return false; }
    try { console.log(`[deleteUserData] Deleting user data for ${userId}.`); await env.USER_DATA.delete(userId.toString()); console.log(`[deleteUserData] User data for ${userId} deleted successfully.`); return true; }
    catch (error) { console.error(`[deleteUserData] Failed to delete user data for ${userId}:`, error); return false; }
}

/**
 * Calculates the age of an account from a given creation date up to the current date.
 * Accounts for Thai timezone (UTC+7) for daily rollover.
 * @param {Date} creationDate - The Date object representing the account creation date.
 * @returns {string} - Formatted string like "X years, Y months, Z days".
 */
export function calculateAccountAge(creationDate) {
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
export function estimateAccountCreationDate(userId) {
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
        // Add more reference points as needed for better accuracy
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

    // Estimate based on average ID growth rate (approximate, can be refined)
    // This is a very rough linear estimation. For better accuracy, a more complex model
    // or more data points would be needed.
    const averageIdsPerDay = 20000000; // This is a rough estimate, can be refined
    const idDifference = userId - closestPoint.id;
    const daysDifference = idDifference / averageIdsPerDay;

    const estimatedDate = new Date(closestPoint.date.getTime() + daysDifference * 24 * 60 * 60 * 1000);
    return estimatedDate;
}

/**
 * Stores a warning for a user in the WARNINGS_KV namespace.
 * Each warning includes the admin who issued it, the reason, and a timestamp.
 * @param {number} userId - The ID of the user to warn.
 * @param {number} adminId - The ID of the admin issuing the warning.
 * @param {string} reason - The reason for the warning.
 * @param {object} env - The Cloudflare environment object (must have WARNINGS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setWarning(userId, adminId, reason, env) {
    if (!env.WARNINGS_KV) {
        console.error("[setWarning] WARNINGS_KV KV namespace is not bound. Cannot store warning.");
        return false;
    }
    try {
        const key = `warnings:${userId}`;
        let warnings = await getWarnings(userId, env); // Get existing warnings
        if (!warnings) {
            warnings = [];
        }

        const newWarning = {
            id: crypto.randomUUID(), // Unique ID for this warning
            admin_id: adminId,
            reason: reason,
            timestamp: new Date().toISOString()
        };
        warnings.push(newWarning);

        await env.WARNINGS_KV.put(key, JSON.stringify(warnings));
        console.log(`[setWarning] Warning stored for user ${userId}. Total warnings: ${warnings.length}`);
        return true;
    } catch (error) {
        console.error(`[setWarning] Error storing warning for user ${userId}:`, error);
        return false;
    }
}

/**
 * Retrieves all warnings for a user from the WARNINGS_KV namespace.
 * @param {number} userId - The ID of the user to retrieve warnings for.
 * @param {object} env - The Cloudflare environment object (must have WARNINGS_KV binding).
 * @returns {Promise<Array<object>|null>} - An array of warning objects, or null if no warnings or error.
 */
export async function getWarnings(userId, env) {
    if (!env.WARNINGS_KV) {
        console.warn("[getWarnings] WARNINGS_KV KV namespace is not bound. Cannot retrieve warnings.");
        return null;
    }
    try {
        const key = `warnings:${userId}`;
        const warningsRaw = await env.WARNINGS_KV.get(key, { type: 'json' });
        if (warningsRaw) {
            console.log(`[getWarnings] Retrieved warnings for user ${userId}: ${JSON.stringify(warningsRaw)}`);
            return Array.isArray(warningsRaw) ? warningsRaw : [];
        }
        console.log(`[getWarnings] No warnings found for user ${userId}.`);
        return [];
    } catch (error) {
        console.error(`[getWarnings] Error retrieving warnings for user ${userId}:`, error);
        return null;
    }
}

/**
 * Clears all warnings for a user from the WARNINGS_KV namespace.
 * @param {number} userId - The ID of the user to clear warnings for.
 * @param {object} env - The Cloudflare environment object (must have WARNINGS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function clearWarnings(userId, env) {
    if (!env.WARNINGS_KV) {
        console.error("[clearWarnings] WARNINGS_KV KV namespace is not bound. Cannot clear warnings.");
        return false;
    }
    try {
        const key = `warnings:${userId}`;
        await env.WARNINGS_KV.delete(key);
        console.log(`[clearWarnings] All warnings cleared for user ${userId}.`);
        return true;
    } catch (error) {
        console.error(`[clearWarnings] Error clearing warnings for user ${userId}:`, error);
        return false;
    }
}

// ============================================================
// NEW: BAN LIST FUNCTIONS (Added for /banlist feature)
// Uses WARNINGS_KV namespace (shared with warnings system)
// Key format: banned_users:${chatId}
// ============================================================

/**
 * Adds a user to the banned list for a specific chat.
 * @param {number} chatId - The ID of the chat/group.
 * @param {object} userData - Object containing user info: { id, name, username, bannedAt, bannedBy }.
 * @param {object} env - The Cloudflare environment object (must have WARNINGS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setBannedUser(chatId, userData, env) {
    if (!env.WARNINGS_KV) {
        console.error("[setBannedUser] WARNINGS_KV KV namespace is not bound. Cannot store banned user.");
        return false;
    }
    try {
        const key = `banned_users:${chatId}`;
        let bannedUsers = await getBannedUsers(chatId, env);
        if (!bannedUsers) {
            bannedUsers = [];
        }

        // Check if user already exists in the list
        const existingIndex = bannedUsers.findIndex(u => u.id === userData.id);
        if (existingIndex !== -1) {
            // Update existing entry
            bannedUsers[existingIndex] = { ...bannedUsers[existingIndex], ...userData };
            console.log(`[setBannedUser] Updated existing banned user ${userData.id} in chat ${chatId}.`);
        } else {
            // Add new entry
            bannedUsers.push(userData);
            console.log(`[setBannedUser] Added new banned user ${userData.id} to chat ${chatId}.`);
        }

        await env.WARNINGS_KV.put(key, JSON.stringify(bannedUsers));
        console.log(`[setBannedUser] Ban list for chat ${chatId} now has ${bannedUsers.length} users.`);
        return true;
    } catch (error) {
        console.error(`[setBannedUser] Error storing banned user for chat ${chatId}:`, error);
        return false;
    }
}

/**
 * Removes a user from the banned list for a specific chat.
 * @param {number} chatId - The ID of the chat/group.
 * @param {number} userId - The ID of the user to remove.
 * @param {object} env - The Cloudflare environment object (must have WARNINGS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function removeBannedUser(chatId, userId, env) {
    if (!env.WARNINGS_KV) {
        console.error("[removeBannedUser] WARNINGS_KV KV namespace is not bound. Cannot remove banned user.");
        return false;
    }
    try {
        const key = `banned_users:${chatId}`;
        let bannedUsers = await getBannedUsers(chatId, env);
        if (!bannedUsers || bannedUsers.length === 0) {
            console.log(`[removeBannedUser] No banned users found for chat ${chatId}.`);
            return true; // Nothing to remove
        }

        const initialLength = bannedUsers.length;
        bannedUsers = bannedUsers.filter(u => u.id !== userId);

        if (bannedUsers.length === initialLength) {
            console.log(`[removeBannedUser] User ${userId} was not in banned list for chat ${chatId}.`);
            return true;
        }

        await env.WARNINGS_KV.put(key, JSON.stringify(bannedUsers));
        console.log(`[removeBannedUser] Removed user ${userId} from ban list of chat ${chatId}. Remaining: ${bannedUsers.length}.`);
        return true;
    } catch (error) {
        console.error(`[removeBannedUser] Error removing banned user ${userId} from chat ${chatId}:`, error);
        return false;
    }
}

/**
 * Retrieves all banned users for a specific chat.
 * @param {number} chatId - The ID of the chat/group.
 * @param {object} env - The Cloudflare environment object (must have WARNINGS_KV binding).
 * @returns {Promise<Array<object>>} - An array of banned user objects, or empty array on error.
 */
export async function getBannedUsers(chatId, env) {
    if (!env.WARNINGS_KV) {
        console.warn("[getBannedUsers] WARNINGS_KV KV namespace is not bound. Cannot retrieve banned users.");
        return [];
    }
    try {
        const key = `banned_users:${chatId}`;
        const bannedRaw = await env.WARNINGS_KV.get(key, { type: 'json' });
        if (bannedRaw) {
            console.log(`[getBannedUsers] Retrieved ${bannedRaw.length} banned users for chat ${chatId}.`);
            return Array.isArray(bannedRaw) ? bannedRaw : [];
        }
        console.log(`[getBannedUsers] No banned users found for chat ${chatId}.`);
        return [];
    } catch (error) {
        console.error(`[getBannedUsers] Error retrieving banned users for chat ${chatId}:`, error);
        return [];
    }
}

/**
 * Checks if a specific user is in the banned list for a chat.
 * @param {number} chatId - The ID of the chat/group.
 * @param {number} userId - The ID of the user to check.
 * @param {object} env - The Cloudflare environment object (must have WARNINGS_KV binding).
 * @returns {Promise<object|null>} - The banned user object if found, null otherwise.
 */
export async function getBannedUser(chatId, userId, env) {
    const bannedUsers = await getBannedUsers(chatId, env);
    const found = bannedUsers.find(u => u.id === userId);
    if (found) {
        console.log(`[getBannedUser] User ${userId} is banned in chat ${chatId}.`);
        return found;
    }
    console.log(`[getBannedUser] User ${userId} is NOT banned in chat ${chatId}.`);
    return null;
}

// ============================================================
// END: BAN LIST FUNCTIONS
// ============================================================


/**
 * Fetches and formats user information.
 * @param {object} user - Telegram User object.
 * @param {number} chatIdForLink - Chat ID to create user's permanent link.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object (to check bot admin status and warnings).
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 * @returns {Promise<object>} - Object containing formatted text and inline keyboard.
 */
export async function getUserInfoDetails(user, chatIdForLink, token, env, botKeyValue) {
    const userId = user.id; // Added userId for direct use
    const isBot = user.is_bot;
    const title = isBot ? "🤖 **Bot Information**" : "👨‍🦰 **User Information**";
    const nameLabel = isBot ? "Bot Name" : "Full Name";
    const idLabel = isBot ? "Bot ID" : "User ID";

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const username = user.username ? `@${user.username}` : 'N/A';
    const premiumStatus = user.is_premium ? '✅ Yes' : '❌ No';
    const languageCode = user.language_code ? user.language_code.toUpperCase() : 'N/A';

    // Telegram Bot API's getChatMember provides more detailed status in chat
    let statusInChat = 'N/A';
    let canSendMessages = '❌'; // Default to ❌, then check permissions
    let canRestrictMembers = '❌'; // Default to ❌, then check permissions
    let groupJoinDate = 'N/A'; // New variable for group join date
    
    // Fetch chat member details for the target user in the specific chat
    try {
        const chatMember = await getChatMember(token, chatIdForLink, user.id, botKeyValue);
        if (chatMember) {
            statusInChat = chatMember.status || 'N/A';
            
            // If the user is a creator or administrator, they should always have these permissions
            // This part is for displaying Telegram's actual chat permissions, not bot's internal admin status
            if (chatMember.status === 'creator' || chatMember.status === 'administrator') {
                canSendMessages = '✅'; 
                canRestrictMembers = '✅'; 
            } else if (chatMember.status === 'member') {
                canSendMessages = '✅'; 
                canRestrictMembers = '❌'; 
            } else if (chatMember.status === 'restricted' || chatMember.status === 'kicked') {
                canSendMessages = '❌';
                canRestrictMembers = '❌';
            }

            // Get group join date if available
            if (chatMember.joined_date) { // Telegram API uses 'date' for join date, but for ChatMember it's 'joined_date'
                groupJoinDate = new Date(chatMember.joined_date * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            } else if (chatMember.date) { // Fallback for older API versions or different contexts
                 groupJoinDate = new Date(chatMember.date * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
        }
    } catch (e) {
        console.warn(`[getUserInfoDetails] Could not get chat member status for user ${user.id} in chat ${chatIdForLink}: ${e.message}`);
    }

    // Check if the user is a BOT ADMIN (hardcoded owner or dynamic admin)
    const isBotAdminStatus = await isUserAdmin(user.id, env) ? '✅ Yes' : '❌ No';

    // Fetch warnings for the user
    const userWarnings = await getWarnings(user.id, env);
    const warningCount = userWarnings ? userWarnings.length : 0;
    const warningStatus = warningCount > 0 ? `🚨 ${warningCount} warnings` : '✅ No warnings';

    // Flags (is_scam, is_fake) are not directly available from getChatMember or User object via Bot API.
    // They are usually from Telegram Client API (e.g., Pyrogram).
    const flags = 'Clean'; // Default, as Bot API doesn't provide these directly

    const accountCreated = estimateAccountCreationDate(user.id);
    const accountCreatedStr = accountCreated.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const accountAge = calculateAccountAge(accountCreated);

    const responseText = (
        `<b>${title}</b>\n` +
        "━━━━━━━━━━━━━━━━\n" +
        `๏ <b>${nameLabel}:</b> ${fullName || 'N/A'}\n` +
        `๏ <b>${idLabel}:</b> <code>${userId}</code>\n` +
        `๏ <b>Username:</b> ${username}\n` +
        `๏ <b>Chat ID:</b> <code>${chatIdForLink}</code>\n` +
        `๏ <b>Chat Type:</b> Supergroup\n` + 
        `๏ <b>Is Bot:</b> ${isBot ? '✅ Yes' : '❌ No'}\n` +
        `๏ <b>Is Premium:</b> ${premiumStatus}\n` +
        `๏ <b>Language Code:</b> ${languageCode}\n` +
        `๏ <b>Status in Chat:</b> ${statusInChat}\n` +
        `๏ <b>Is Bot Admin:</b> ${isBotAdminStatus}\n` + // New line to show bot admin status
        `๏ <b>Can Send Messages:</b> ${canSendMessages}\n` +
        `๏ <b>Can Restrict Members:</b> ${canRestrictMembers}\n` +
        `๏ <b>Ban Status:</b> ✅ Not Banned\n` + 
        `๏ <b>Flags:</b> ${flags}\n` +
        `๏ <b>Account Created On:</b> ${accountCreatedStr}\n` +
        `๏ <b>Account Age:</b> ${accountAge}\n` +
        `๏ <b>Group Join Date:</b> ${groupJoinDate}\n` + // New line for group join date
        `๏ <b>Warnings:</b> ${warningStatus}\n` + // New line for warning status
        "━━━━━━━━━━━━━━━━"
    );

    const inlineKeyboard = {
        inline_keyboard: [
            [{ 
                text: fullName || `User ${user.id}`, // Button text is the user's full name or "User ID"
                url: `tg://user?id=${user.id}` // Open user's profile directly
            }]
        ]
    };

    return { text: responseText, reply_markup: inlineKeyboard };
}
