// chatHistoryAndSummarization.js
// This file handles chat message storage for history and the summarization feature.

import { sendMessage } from './telegramApiHelpers';
import { isUserAdmin } from './userManagementFunctions';

// Define a maximum number of concurrent KV get requests to avoid hitting Cloudflare limits
const MAX_CONCURRENT_KV_GETS = 20; // Adjust this value if you still hit limits (e.g., 10, 50)

/**
 * Stores a chat message in KV for a limited duration (e.g., 3 days).
 * @param {object} message - The Telegram message object.
 * @param {object} env - The Cloudflare environment object (must have CHAT_HISTORY_KV binding).
 */
export async function storeChatMessage(message, env) {
    if (!env.CHAT_HISTORY_KV || (message.chat.type !== "group" && message.chat.type !== "supergroup") || !message.text || (message.from && message.from.is_bot)) {
        console.log("[storeChatMessage] Skipping history storage (not a group/text message or from a bot, or KV not bound).");
        return;
    }

    const chatId = message.chat.id;
    const timestamp = new Date().toISOString(); 
    const key = `${chatId}_${timestamp}_${message.message_id}`; 
    const messageToStore = {
        message_id: message.message_id,
        from: {
            id: message.from.id,
            first_name: message.from.first_name,
            last_name: message.from.last_name,
            username: message.from.username,
        },
        text: message.text,
        date: message.date, 
    };

    try {
        // Store messages for 3 days (259200 seconds)
        await env.CHAT_HISTORY_KV.put(key, JSON.stringify(messageToStore), { expirationTtl: 259200 }); 
        console.log(`[storeChatMessage] Stored message ${message.message_id} from chat ${chatId} in KV.`);
    } catch (error) {
        console.error(`[storeChatMessage] Failed to store message ${message.message_id} in KV:`, error);
    }
}

/**
 * Retrieves recent chat messages from KV for a given chat ID.
 * Filters messages from the last X hours (default to 72 hours / 3 days).
 * @param {number} chatId - The ID of the chat.
 * @param {object} env - The Cloudflare environment object (must have CHAT_HISTORY_KV binding).
 * @param {number} hours - Number of hours back to retrieve messages.
 * @returns {Promise<Array<object>>} - An array of recent message objects, sorted by date.
 */
export async function getRecentChatHistory(chatId, env, hours = 72) { // Default to 72 hours (3 days)
    if (!env.CHAT_HISTORY_KV) {
        console.warn("[getRecentChatHistory] CHAT_HISTORY_KV KV namespace is not bound. Cannot retrieve history.");
        return [];
    }

    const lookbackTime = Date.now() - (hours * 60 * 60 * 1000); // Calculate lookback time in milliseconds
    let allKeys = [];
    let cursor = null;
    let isTruncated = true;

    try {
        // Loop to fetch all keys, handling pagination with cursor
        while (isTruncated) {
            const listOptions = { prefix: `${chatId}_`, limit: 1000 }; // Max limit per list call
            if (cursor) {
                listOptions.cursor = cursor;
            }
            const listResponse = await env.CHAT_HISTORY_KV.list(listOptions);
            
            console.log(`[getRecentChatHistory] Fetched ${listResponse.keys.length} keys. Is truncated: ${listResponse.list_complete ? 'false' : 'true'}.`);

            // Filter keys that are within the lookback period
            const currentBatchKeys = listResponse.keys.filter(key => {
                const parts = key.name.split('_');
                // Ensure the key format is as expected before parsing
                if (parts.length >= 3) {
                    const isoTimestamp = parts[1]; 
                    const messageTimestamp = new Date(isoTimestamp).getTime(); 
                    return messageTimestamp >= lookbackTime;
                }
                console.warn(`[getRecentChatHistory] Skipping malformed key: ${key.name}`);
                return false;
            }).map(key => key.name); // Get only the key names

            allKeys.push(...currentBatchKeys);

            isTruncated = !listResponse.list_complete;
            cursor = listResponse.cursor;

            // Add a small delay to avoid hitting rate limits if there are many pages
            if (isTruncated) {
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        }

        console.log(`[getRecentChatHistory] Total relevant keys found: ${allKeys.length}`);

        let allMessages = [];
        // Process keys in smaller batches to avoid "Too many API requests" during 'get' operations
        for (let i = 0; i < allKeys.length; i += MAX_CONCURRENT_KV_GETS) {
            const batchKeys = allKeys.slice(i, i + MAX_CONCURRENT_KV_GETS);
            const fetchPromises = batchKeys.map(async keyName => {
                try {
                    const messageString = await env.CHAT_HISTORY_KV.get(keyName);
                    if (messageString) {
                        return JSON.parse(messageString);
                    }
                } catch (error) {
                    console.error(`[getRecentChatHistory] Error fetching/parsing message for key ${keyName} in batch:`, error);
                }
                return null;
            });
            const messagesBatch = await Promise.all(fetchPromises);
            allMessages.push(...messagesBatch.filter(msg => msg !== null));

            // Add a small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }

        // Sort all collected messages by date (Unix timestamp)
        allMessages.sort((a, b) => a.date - b.date);

        // Trim messages if there are too many for summarization (e.g., for LLM input or display)
        const MAX_MESSAGES_FOR_SUMMARY = 150; // You can adjust this limit based on your needs
        if (allMessages.length > MAX_MESSAGES_FOR_SUMMARY) {
            allMessages = allMessages.slice(-MAX_MESSAGES_FOR_SUMMARY); // Get the most recent messages
            console.log(`[getRecentChatHistory] Trimmed history to ${MAX_MESSAGES_FOR_SUMMARY} messages.`);
        }

        console.log(`[getRecentChatHistory] Retrieved ${allMessages.length} recent messages for chat ${chatId}.`);
        return allMessages;

    } catch (error) {
        console.error(`[getRecentChatHistory] Failed to retrieve chat history for chat ${chatId}:`, error);
        return [];
    }
}

/**
 * Creates a summary HTML page and stores it in KV, returning its public URL.
 * @param {string} summaryTextContent - The plain text content of the summary.
 * @param {number} chatId - The ID of the chat.
 * @param {string} groupTitle - The title of the group.
 * @param {object} env - The Cloudflare environment object (must have SUMMARY_KV binding).
 * @param {string} requestOrigin - The origin URL of the incoming request (e.g., "https://your-pages-domain.pages.dev").
 * @returns {Promise<string|null>} - The public URL of the summary page, or null on failure.
 */
export async function createSummaryPageAndGetUrl(summaryTextContent, chatId, groupTitle, env, requestOrigin) {
    if (!env.SUMMARY_KV) {
        console.error("[createSummaryPageAndGetUrl] SUMMARY_KV KV namespace is not bound. Cannot create summary page.");
        return null;
    }

    const summaryId = crypto.randomUUID(); // Unique ID for the summary page
    const pageTitle = `Group Chat Summary - ${groupTitle}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="my">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f0f2f5; color: #333; }
        .container { max-width: 800px; margin: 2rem auto; padding: 1.5rem; background-color: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        h1 { 
            font-weight: 800; 
            margin-bottom: 1rem; 
            text-align: center; 
            font-size: 2.5rem; 
            background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: rainbow-text 10s linear infinite;
            position: relative;
            overflow: hidden; 
            padding: 10px 0; 
        }

        @keyframes rainbow-text {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
        }

        @keyframes fly-butterfly {
            0% { transform: translateX(-100vw) translateY(0) rotate(0deg); opacity: 0; }
            25% { transform: translateX(-50vw) translateY(-20px) rotate(10deg); opacity: 1; }
            50% { transform: translateX(0vw) translateY(0) rotate(0deg); opacity: 1; }
            75% { transform: translateX(50vw) translateY(-20px) rotate(-10deg); opacity: 1; }
            100% { transform: translateX(100vw) translateY(0) rotate(0deg); opacity: 0; }
        }

        @keyframes twinkle-star {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.5); opacity: 1; }
        }

        @keyframes fly-bird {
            0% { transform: translateX(-100vw) translateY(50px); opacity: 0; }
            20% { transform: translateX(-80vw) translateY(30px); opacity: 1; }
            40% { transform: translateX(-60vw) translateY(50px); opacity: 1; }
            60% { transform: translateX(-40vw) translateY(30px); opacity: 1; }
            80% { transform: translateX(-20vw) translateY(50px); opacity: 1; }
            100% { transform: translateX(0vw) translateY(30px); opacity: 0; }
        }


        h1::before {
            content: '🦋'; 
            position: absolute;
            left: -50px;
            top: 20%;
            font-size: 1.5em;
            animation: fly-butterfly 15s linear infinite;
            animation-delay: 0s;
        }

        h1::after {
            content: '✨'; 
            position: absolute;
            right: -50px;
            top: 50%;
            font-size: 1.2em;
            animation: twinkle-star 3s ease-in-out infinite alternate;
            animation-delay: 0.5s;
        }

        .header-bird {
            content: '🐦'; 
            position: absolute;
            left: -100px; 
            top: 70%;
            font-size: 1.3em;
            animation: fly-bird 20s linear infinite;
            animation-delay: 2s; 
        }


        .summary-content { 
            background-color: #f8fafc; 
            padding: 1.5rem; 
            border-radius: 8px; 
            line-height: 1.6; 
            white-space: pre-wrap; 
            word-wrap: break-word; 
            display: flex; 
            flex-direction: column; 
        }
        .summary-line {
            display: block; 
            padding: 2px 0; 
            font-weight: 500; 
        }
        .summary-line:nth-child(6n+1) { color: #EF4444; } 
        .summary-line:nth-child(6n+2) { color: #F97316; } 
        .summary-line:nth-child(6n+3) { color: #EAB308; } 
        .summary-line:nth-child(6n+4) { color: #22C55E; } 
        .summary-line:nth-child(6n+5) { color: #3B82F6; } 
        .summary-line:nth-child(6n+6) { color: #8B5CF6; } 


        .footer { margin-top: 2rem; text-align: center; font-size: 0.9em; color: #666; }
        @media (max-width: 640px) {
            .container { margin: 1rem 0.5rem; padding: 1rem; }
            h1 { font-size: 1.5rem; }
            h1::before, h1::after, .header-bird { font-size: 1em; } 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 id="animated-title">🚀 ${groupTitle} Group Summary 🚀</h1>
        <div class="header-bird"></div> 
        <p class="text-center text-gray-600 mb-6">📝Group စကားဝိုင်း အကျဥ်းချုပ်မှတ်တမ်း📝</p>
        <div id="summary-content-placeholder" class="summary-content">
            <!-- Summary content will be inserted here by JavaScript -->
        </div>
        <div class="footer">
            <p> 🚀🌈🌟 မောင်သုည 🌟🌈🚀 </p>
            <p>&copy; ${new Date().getFullYear()} Link Checker Bot by 𝗠𝗮𝘂𝗻𝗴 𝗧𝗵𝗼𝗻𝗻𝘆𝗮.</p>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const summaryText = \`${summaryTextContent.replace(/`/g, '\\`')}\`; 
            const summaryLines = summaryText.split('\\n');
            const summaryContentDiv = document.getElementById('summary-content-placeholder');
            summaryContentDiv.innerHTML = ''; 

            summaryLines.forEach((line, index) => {
                const span = document.createElement('span');
                span.classList.add('summary-line');
                span.textContent = line;
                summaryContentDiv.appendChild(span);
            });
        });
    </script>
</body>
</html>
    `;

    try {
        // Store HTML content in KV for 24 hours (86400 seconds)
        await env.SUMMARY_KV.put(`summary:${summaryId}`, htmlContent, { expirationTtl: 86400 });
        const summaryUrl = `${requestOrigin}/summary/${summaryId}`;
        console.log(`[createSummaryPageAndGetUrl] Summary page created at: ${summaryUrl}`);
        return summaryUrl;
    } catch (error) {
        console.error(`[createSummaryPageAndGetUrl] Error storing summary page for ID ${summaryId}:`, error);
        return null; // Return null on error
    }
}

/**
 * Handles the /summarize command for group chat discussions.
 * This version generates a summary from recent chat history without using AI.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} requestOrigin - The origin URL of the incoming request.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleSummarizeCommand(message, token, env, requestOrigin, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;
    const groupTitle = message.chat.title || "Group";

    if (message.chat.type !== "group" && message.chat.type !== "supergroup") {
        await sendMessage(token, chatId, "ဤ Command ကို Group များတွင်သာ အသုံးပြုနိုင်ပါသည်။", 'HTML', null, botKeyValue);
        return;
    }

    // Corrected call to isUserAdmin: pass fromUser.id and env
    const isAdmin = await isUserAdmin(fromUser.id, env);
    if (!isAdmin) {
        const userLinkDisplayName = fromUser.first_name || fromUser.username || "အမည်မသိသူ";
        const userLink = `<a href="tg://user?id=${fromUser.id}"><b>${userLinkDisplayName}</b></a>`;
        await sendMessage(token, chatId, `${userLink} <b>🚫 "I'm sorry, you don't have permission to use this command! Please request what you need! 👱‍♂️</b>`, 'HTML', null, botKeyValue);
        return; 
    }

    await sendMessage(token, chatId, "Group ရဲ့ စကားဝိုင်းမှတ်တမ်းများကို အကျဥ်းချုပ်နေပါသည်။      ခဏစောင့်ပါ...", 'HTML', null, botKeyValue);

    // Retrieve messages for the last 3 days (72 hours)
    const recentMessages = await getRecentChatHistory(chatId, env, 72); 

    if (recentMessages.length === 0) {
        await sendMessage(token, chatId, "စကားဝိုင်းမှတ်တမ်းတွေ မရှိသေးလို့ အကျဥ်းချုပ်ဖော်ပြပေးလို့ မရသေးပါဘူး။ Message လေးတွေ ပို့ပြီးမှ ပြန်ပြောပေးနော် 😊", 'HTML', null, botKeyValue);
        return; 
    }

    let summaryTextContent = `Group Chat Summary for "${groupTitle}" (Past 3 Days):\n\n`; // Changed to Past 3 Days
    for (const msg of recentMessages) {
        const senderName = msg.from.first_name || msg.from.username || `User_${msg.from.id}`;
        const messageTime = new Date(msg.date * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' });
        summaryTextContent += `${senderName} (${messageTime}): ${msg.text}\n`;
    }

    const summaryPageUrl = await createSummaryPageAndGetUrl(summaryTextContent, chatId, groupTitle, env, requestOrigin);

    if (summaryPageUrl) {
        const summaryMessageText = `Group စကားဝိုင်းမှတ်တမ်းများကို အကျဥ်းချုပ်ထားပါတယ်။ အောက်က Button လေးကို နှိပ်ပြီး အပြည့်အစုံ ဖတ်ရှုနိုင်ပါတယ်💖`;
        const inline_keyboard = [[{ text: `📝 Group Summary ကို ဖတ်ရန်`, url: summaryPageUrl }]];
        const reply_markup = { inline_keyboard: inline_keyboard };

        await sendMessage(token, chatId, summaryMessageText, 'HTML', reply_markup, botKeyValue);
        console.log("[handleSummarizeCommand] Sent summary link.");
    } else {
        await sendMessage(token, chatId, "❌ စကားဝိုင်းမှတ်တမ်းများကို အကျဥ်းချုပ်ရာတွင် အမှားအယွင်းရှိခဲ့ပါသည်။ ကျေးဇူးပြု၍ နောက်တစ်ကြိမ် ထပ်မံကြိုးစားပါ။", 'HTML', null, botKeyValue);
    }
}

/**
 * Deletes all chat history for a given chat ID from KV.
 * @param {number} chatId - The ID of the chat/group.
 * @param {object} env - The Cloudflare environment object (must have CHAT_HISTORY_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function deleteChatHistory(chatId, env) {
    if (!env.CHAT_HISTORY_KV) {
        console.warn("[deleteChatHistory] CHAT_HISTORY_KV KV namespace is not bound. Cannot delete history.");
        return false;
    }

    let cursor = null;
    let isTruncated = true;
    let deletedCount = 0;

    try {
        while (isTruncated) {
            const listOptions = { prefix: `${chatId}_`, limit: 1000 };
            if (cursor) {
                listOptions.cursor = cursor;
            }
            const listResponse = await env.CHAT_HISTORY_KV.list(listOptions);

            const deletePromises = listResponse.keys.map(key => env.CHAT_HISTORY_KV.delete(key.name));
            await Promise.all(deletePromises);
            deletedCount += listResponse.keys.length;

            isTruncated = !listResponse.list_complete;
            cursor = listResponse.cursor;

            if (isTruncated) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between list calls
            }
        }
        console.log(`[deleteChatHistory] Successfully deleted ${deletedCount} messages for chat ${chatId}.`);
        return true;
    } catch (error) {
        console.error(`[deleteChatHistory] Error deleting chat history for chat ${chatId}:`, error);
        return false;
    }
}

/**
 * Handles the /deletesummary command.
 * Allows an admin to manually delete all chat history for a group.
 * @param {object} message - Telegram Message object.
 * @param {string} token - Telegram Bot Token.
 * @param {object} env - Cloudflare Environment object.
 * @param {string} botKeyValue - The BOT_DATA key for validation.
 */
export async function handleDeleteSummaryCommand(message, token, env, botKeyValue) {
    const chatId = message.chat.id;
    const fromUser = message.from;

    if (message.chat.type !== "group" && message.chat.type !== "supergroup") {
        await sendMessage(token, chatId, "ဤ Command ကို Group များတွင်သာ အသုံးပြုနိုင်ပါသည်။", 'HTML', null, botKeyValue);
        return;
    }

    const isAdmin = await isUserAdmin(fromUser.id, env);
    if (!isAdmin) {
        const userLinkDisplayName = fromUser.first_name || fromUser.username || "အမည်မသိသူ";
        const userLink = `<a href="tg://user?id=${fromUser.id}"><b>${userLinkDisplayName}</b></a>`;
        await sendMessage(token, chatId, `${userLink} <b>🚫 "I'm sorry, you don't have permission to use this command! Please request what you need! 👱‍♂️</b>`, 'HTML', null, botKeyValue);
        return; 
    }

    await sendMessage(token, chatId, "Group ရဲ့ စကားဝိုင်းမှတ်တမ်းများကို ဖျက်နေပါသည်။ ခဏစောင့်ပါ...", 'HTML', null, botKeyValue);

    const success = await deleteChatHistory(chatId, env);

    if (success) {
        await sendMessage(token, chatId, "✅ Group ရဲ့ စကားဝိုင်းမှတ်တမ်းများအားလုံးကို အောင်မြင်စွာ ဖျက်လိုက်ပါပြီ။", 'HTML', null, botKeyValue);
    } else {
        await sendMessage(token, chatId, "❌ Group ရဲ့ စကားဝိုင်းမှတ်တမ်းများကို ဖျက်၍ မရပါ။", 'HTML', null, botKeyValue);
    }
}

