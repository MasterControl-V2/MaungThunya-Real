// _middleware.js
// This is the main entry point for the Cloudflare Pages Function.
// It handles incoming Telegram webhook updates and dispatches them to appropriate handlers.

import { 
    TELEGRAM_API, 
    ADMIN_USERNAME, 
    SUPPORT_GROUP_LINK, 
    CONTROL_BOT_URL, 
    PUBLIC_BOT_ADMIN_COMMANDS,
    PUBLIC_BOT_PUBLIC_COMMANDS, 
    PUBLIC_BOT_OWNER_COMMANDS, 
    OWNER_ADMIN_IDS,
    GOOGLE_SAFE_BROWSING_API_KEY, 
} from './constants';
import { 
    sendMessage, 
    getMe, 
    answerCallbackQuery, 
    editMessageText,
    setMyCommands,
    getChatMember
} from './telegramApiHelpers';
import { 
    isUserAdmin, 
    isUserOwner, 
    deleteUserData, 
    handleAddAdminCommand, 
    handleDeleteAdminCommand, 
    getAdminIds, 
    setAdminIds, 
    setAdminNames,
} from './userManagementFunctions';
import { 
    handleSetContentCommand, 
    handleGetContentCommand, 
    handleDeleteContentCommand, 
    handleGetCombinedCommand 
} from './contentCommandHandlers';
import { 
    storeChatMessage, 
    handleSummarizeCommand,
    handleDeleteSummaryCommand 
} from './chatHistoryAndSummarization';
import { 
    handleCheckUrlCommand, 
    handleForexCommand,     
    handleSetMMKOffsetCommand, 
    handleSetTHBOffsetCommand, 
    handleStartCommand,     
    handleReplyBanCommand,  
    handleBanCommandById,   
    handleMuteCommandById,  
    handleIdCommand,        
    handleInfoCommand,      
    handleWarnCommand,      
    handleUnwarnCommand,    
    handleWarningsCommand,
    handleListAdminCommand,
    handleBanListCommand // Ban list command
} from './commandHandlers'; 

// NEW: Real address handler
import { handleRealAddressCommand } from './realAddressHandlers';

import {
    handleChatMemberUpdate, 
    handleSpamDetectionAndMute, 
    handleCallbackQuery, 
    handleMessageUpdateForNameChange 
} from './updateHandlers'; 


// Global variable to store bot ID after first fetch for efficient passive mode check
let botIdCache = null;

// --- Main Pages Function Entry Point ---
export async function onRequest(context) {
    const { request, env } = context;
    const token = env.TELEGRAM_BOT_TOKEN; 

    console.log(`[onRequest] Received request: ${request.method} ${request.url}`);
    
    let requestBody = {};
    try {
        if (request.method === "POST" && request.headers.get("content-type")?.includes("application/json")) {
            requestBody = await request.clone().json();
            console.log("[onRequest] Full incoming request body:", JSON.stringify(requestBody, null, 2));
        } else {
            console.log("[onRequest] Request headers (non-JSON/non-POST):", JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
        }
    } catch (e) {
        console.error("[onRequest] Failed to parse request body as JSON:", e.message);
        console.log("[onRequest] Request headers (body parse error):", JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
    }

    if (!token) {
        console.error("[onRequest] Error: TELEGRAM_BOT_TOKEN environment variable is not set in this bot's Cloudflare Pages.");
        return new Response("TELEGRAM_BOT_TOKEN environment variable is not set.", { status: 500 });
    }

    const url = new URL(request.url);

    const BOT_KEY = env.BOT_DATA; 

    // --- Webhook Registration/Unregistration Routes ကို ကိုင်တွယ်ခြင်း ---
    if (request.method === "GET" && url.pathname.endsWith("/registerWebhook")) {
        const pagesUrl = url.origin + url.pathname.replace("/registerWebhook", "/");
        console.log(`[onRequest] Registering webhook for user's bot to Telegram: ${pagesUrl}`);
        const setWebhookApiUrl = `${TELEGRAM_API}${token}/setWebhook`;
        const payload = { url: pagesUrl, allowed_updates: ["message", "chat_member", "callback_query"] };
        try {
            const response = await fetch(setWebhookApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Bot-Key": BOT_KEY 
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (response.ok && result.ok) { 
                console.log("[onRequest] Webhook registration successful:", result); 
                
                // Webhook register လုပ်ပြီးနောက် bot commands များ သတ်မှတ်ပါ။
                const allCommands = [
                    ...PUBLIC_BOT_PUBLIC_COMMANDS.map(cmd => {
                        let description = "";
                        switch(cmd) {
                            case '/start': description = 'Bot ကို စတင်ရန်'; break;
                            case '/id': description = 'သင့် ID ကို ပြသရန်'; break;
                            case '/listadmin': description = 'Bot Admin များစာရင်းကို ပြသရန်'; break;
                            case '/forex': description = 'ငွေလဲနှုန်းစစ်ဆေးရန်'; break;
                            case '/rate': description = 'ငွေလဲနှုန်းစစ်ဆေးရန်'; break;
                            case '/fake': description = 'Real Address ထုတ်လုပ်ရန်'; break; // NEW
                            case '/address': description = 'Real Address ထုတ်လုပ်ရန်'; break; // NEW
                            default: description = 'Command Description';
                        }
                        return { command: cmd.substring(1), description: description };
                    }),
                    ...PUBLIC_BOT_ADMIN_COMMANDS.map(cmd => {
                        let description = "";
                        switch(cmd) {
                            case '/setkey': description = 'Keyword စာသားသတ်မှတ်ရန်'; break;
                            case '/setfile': description = 'Keyword File သတ်မှတ်ရန်'; break;
                            case '/setphoto': description = 'Keyword Photo သတ်မှတ်ရန်'; break;
                            case '/key': description = 'Keyword စာသားရှာရန်'; break;
                            case '/file': description = 'Keyword File ရှာရန်'; break;
                            case '/photo': description = 'Keyword Photo ရှာရန်'; break;
                            case '/getcombined': description = 'Keyword စာသား/ဖိုင်/ဓာတ်ပုံ ရှာရန်'; break;
                            case '/gc': description = 'Keyword စာသား/ဖိုင်/ဓာတ်ပုံ ရှာရန် (အတိုကောက်)'; break;
                            case '/deletekey': description = 'Keyword စာသားဖျက်ရန်'; break;
                            case '/deletefile': description = 'Keyword File ဖျက်ရန်'; break;
                            case '/deletephoto': description = 'Keyword Photo ဖျက်ရန်'; break;
                            case '/deleteuser': description = 'User Data ဖျက်ရန်'; break;
                            case '/ban': description = 'User ကို Ban ရန်'; break;
                            case '/mute': description = 'User ကို Mute ရန်'; break;
                            case '/summarize': description = 'Group Chat မှတ်တမ်းများကို အကျဉ်းချုပ်ရန်'; break;
                            case '/deletesummary': description = 'Group Chat မှတ်တမ်းများ ဖျက်ရန်'; break; 
                            case '/info': description = 'User အချက်အလက်ကြည့်ရန်'; break;
                            case '/warn': description = 'User ကို သတိပေးရန်'; break;
                            case '/unwarn': description = 'User သတိပေးချက်ဖျက်ရန်'; break;
                            case '/warnings': description = 'User သတိပေးချက်များကြည့်ရန်'; break;
                            case '/check': description = 'URL ဘေးကင်းမှုစစ်ဆေးရန်'; break;
                            case '/setmmkoffset': description = 'MMK Offset သတ်မှတ်ရန်'; break;
                            case '/setthboffset': description = 'THB Offset သတ်မှတ်ရန်'; break;
                            case '/banlist': description = 'Ban ထားသော User များစာရင်းကြည့်ရန်'; break;
                            default: description = 'Command Description';
                        }
                        return { command: cmd.substring(1), description: description };
                    }),
                    ...PUBLIC_BOT_OWNER_COMMANDS.map(cmd => {
                        let description = "";
                        switch(cmd) {
                            case '/addadmin': description = 'Admin အသစ်ထည့်ရန် (Owner Only)'; break;
                            case '/deleteadmin': description = 'Admin ဖယ်ရှားရန် (Owner Only)'; break;
                            default: description = 'Command Description';
                        }
                        return { command: cmd.substring(1), description: description };
                    })
                ];

                await setMyCommands(token, allCommands, 'all_private_chats', null, BOT_KEY);
                
                return new Response(`Webhook registered to: ${pagesUrl} (Success: ${result.ok})`, { status: 200 }); 
            }
            else { console.error("[onRequest] Webhook registration failed:", result); return new Response(`Webhook registration failed: ${result.description || JSON.stringify(result)}`, { status: 500 }); }
        } catch (error) { console.error("[onRequest] Error during webhook registration fetch:", error); return new Response(`Error registering webhook: ${error.message}`, { status: 500 }); }
    } else if (request.method === "GET" && url.pathname.endsWith("/unregisterWebhook")) {
        const deleteWebhookApiUrl = `${TELEGRAM_API}${token}/deleteWebhook`;
        try {
            const response = await fetch(deleteWebhookApiUrl, {
                headers: {
                    "X-Bot-Key": BOT_KEY 
                }
            });
            const result = await response.json();
            if (response.ok && result.ok) { console.log("[onRequest] Webhook unregistered successfully:", result); return new Response(`Webhook unregistration failed (Success: ${result.ok})`, { status: 200 }); }
            else { console.error("[onRequest] Webhook unregistration failed:", result); return new Response(`Webhook unregistration failed: ${result.description || JSON.stringify(result)}`, { status: 500 }); }
        } catch (error) { console.error("[onRequest] Error during webhook unregistration fetch:", error); return new Response(`Error unregistering webhook: ${error.message}`, { status: 500 }); }
    }

    // --- Summary Page Requests (for GET requests to /summary/<id>) ကို ကိုင်တွယ်ခြင်း ---
    if (request.method === "GET" && url.pathname.startsWith("/summary/")) {
        const summaryId = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
        if (!env.SUMMARY_KV) {
            console.error("[SummaryPageHandler] SUMMARY_KV namespace is not bound.");
            return new Response("Summary service unavailable.", { status: 500 });
        }
        try {
            const htmlContent = await env.SUMMARY_KV.get(`summary:${summaryId}`);
            if (htmlContent) {
                console.log(`[SummaryPageHandler] Serving summary page for ID: ${summaryId}`);
                return new Response(htmlContent, {
                    headers: { 'Content-Type': 'text/html' },
                    status: 200
                });
            } else {
                console.log(`[SummaryPageHandler] Summary page not found or expired for ID: ${summaryId}`);
                return new Response("Summary not found or expired. Please request a new summary from the bot.", { status: 404 });
            }
        } catch (error) {
            console.error(`[SummaryPageHandler] Error retrieving summary page for ID ${summaryId}:`, error);
            return new Response("Error retrieving summary page.", { status: 500 });
        }
    }


    // --- Main Telegram Update Handling (POST requests from Telegram) ---
    if (request.method === "POST") {
        try {
            const update = requestBody;

            if (Object.keys(update).length === 0) {
                 console.warn("[onRequest] Received an empty or unparseable Telegram update body. Skipping processing.");
                 return new Response("OK - Empty update received", { status: 200 });
            }

            // --- Public User Bot Access Control ---
            if (!BOT_KEY) {
                console.warn("[onRequest] BOT_DATA environment variable is not set. Access denied for Public User Bot.");
                let chatId = null;
                if (update.message) { chatId = update.message.chat.id; }
                else if (update.chat_member) { chatId = update.chat_member.chat.id; }
                else if (update.callback_query && update.callback_query.message) { chatId = update.callback_query.message.chat.id; }

                if (chatId) {
                    const userFriendlyMessage = `
<b>🚨 Bot Service အလုပ်မလုပ်တော့ပါ 🚨</b>

Bot Key ကို မှန်ကန်စွာ သတ်မှတ်ထားခြင်း မရှိပါ။ ကျေးဇူးပြု၍ Bot Owner ကို ဆက်သွယ်ပါ။
                    `;
                    const reply_markup = {
                        inline_keyboard: [
                            [{ text: "👤 Bot Owner ကို ဆက်သွယ်ရန်", url: `https://t.me/${ADMIN_USERNAME.substring(1)}` }],
                            [{ text: "👥 ပံ့ပိုးကူညီမှု Group သို့ ဝင်ရန်", url: SUPPORT_GROUP_LINK }]
                        ]
                    };
                    await sendMessage(token, chatId, userFriendlyMessage, 'HTML', reply_markup, BOT_KEY);
                }
                return new Response("OK", { status: 200 }); 
            }

            const validationResponse = await fetch(CONTROL_BOT_URL, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    'X-Bot-Key': BOT_KEY 
                },
                body: JSON.stringify({ type: 'validate_key', key: BOT_KEY }) 
            });

            if (!validationResponse.ok) {
                const errorText = await validationResponse.text();
                console.warn(`[onRequest] Public User Bot Access Denied by Control Bot: ${validationResponse.status} - ${errorText}`);

                let chatId = null;
                if (update.message) {
                    chatId = update.message.chat.id;
                } else if (update.chat_member) {
                    chatId = update.chat_member.chat.id;
                } else if (update.callback_query && update.callback_query.message) {
                    chatId = update.callback_query.message.chat.id;
                }

                if (chatId) {
                    const userFriendlyMessage = `
<b>🚨Bot Service သတိပေးချက်🚨</b>

⚠️ သင်အသုံးပြုနေသော Bot သည် သက်တမ်းကုန်ဆုံးသွားခြင်း (သို့မဟုတ်) ပိတ်သိမ်းထားခြင်း
ခံရပါသည်။

အသေးစိတ်သိရှိလိုပါက Bot Owner ကို ဆက်သွယ်နိူင်ပါသည်။
                    `; 
                    const reply_markup = {
                        inline_keyboard: [
                            [{ text: "👤 Bot Owner ကို ဆက်သွယ်ရန်", url: `https://t.me/${ADMIN_USERNAME.substring(1)}` }],
                            [{ text: "👥 ပံ့ပိုးကူညီမှု Group သို့ ဝင်ရန်", url: SUPPORT_GROUP_LINK }]
                        ]
                    };
                    await sendMessage(token, chatId, userFriendlyMessage, 'HTML', reply_markup, BOT_KEY);
                }
                
                return new Response("OK", { status: 200 });
            }
            console.log(`[onRequest] Public User Bot key ${BOT_KEY} validated by Control Bot.`);
            // --- End Public User Bot Access Control ---

            // --- Initial Admin Setup ---
            const currentStoredAdminIds = await getAdminIds(env);
            if (currentStoredAdminIds.length === 0 && OWNER_ADMIN_IDS.length > 0) {
                console.log("[onRequest] ADMIN_IDS_KV is empty. Initializing with OWNER_ADMIN_IDS from constants.js.");
                const initialAdminNames = [];
                for (const id of OWNER_ADMIN_IDS) {
                    let name = `Initial Admin ${id}`;
                    try {
                        const userInfo = await getMe(token, BOT_KEY);
                        if (userInfo && userInfo.id === id) {
                            name = userInfo.first_name || userInfo.username || name;
                        } else if (update.message?.chat.id) {
                            const chatMemberInfo = await getChatMember(token, update.message.chat.id, id, BOT_KEY);
                            if (chatMemberInfo && chatMemberInfo.user) {
                                name = chatMemberInfo.user.first_name || chatMemberInfo.user.username || name;
                            }
                        }
                    } catch (e) {
                        console.warn(`[onRequest] Could not fetch name for initial admin ID ${id}: ${e.message}`);
                    }
                    initialAdminNames.push({ id: id, name: name });
                }
                await setAdminIds(OWNER_ADMIN_IDS, env);
                await setAdminNames(initialAdminNames, env);
                console.log("[onRequest] Initial OWNER_ADMIN_IDS and names populated to KV.");
            }
            // --- End Initial Admin Setup ---


            if (update.chat_member) {
                console.log("[onRequest] Handling chat_member update.");
                // UPDATED: Pass 'context' as 5th argument for auto-delete feature
                await handleChatMemberUpdate(update.chat_member, token, env, BOT_KEY, context);
            } else if (update.message) {
                const message = update.message;
                console.log(`[onRequest] Handling message update from user ${message.from.id} in chat ${message.chat.id}. Type: ${message.chat.type}`);
                
                const isSenderBot = message.from && message.from.is_bot;
                const isSenderBotAdmin = await isUserAdmin(message.from.id, env);
                const isSenderOwner = isUserOwner(message.from.id);

                console.log(`[onRequest] Message in group/supergroup. isSenderBot: ${isSenderBot}, isSenderBotAdmin: ${isSenderBotAdmin}, isSenderOwner: ${isSenderOwner}`);

                if (message.chat.type === "group" || message.chat.type === "supergroup") {
                    if (!isSenderBot && !isSenderBotAdmin) {
                        console.log("[onRequest] Sender is not bot or bot admin. Running spam detection.");
                        const isSpamDetectedAndMuted = await handleSpamDetectionAndMute(message, token, BOT_KEY);
                        if (isSpamDetectedAndMuted) {
                            console.log("[onRequest] Spam detected and user muted. Returning OK.");
                            return new Response("OK", { status: 200 });
                        }
                    } else {
                        console.log("[onRequest] Sender is bot or bot admin. Skipping spam detection.");
                    }
                }

                if (message.chat.type === "group" || message.chat.type === "supergroup") {
                    await storeChatMessage(message, env); 
                }

                if (message.text && message.text.startsWith('/')) {
                    console.log(`[onRequest] Message text: "${message.text.substring(0, 50)}..."`);
                    const command = message.text.split(' ')[0].toLowerCase();
                    
                    console.log(`[onRequest] Debugging command: "${command}" (length: ${command.length})`);
                    console.log(`[onRequest] Is command in PUBLIC_BOT_OWNER_COMMANDS? ${PUBLIC_BOT_OWNER_COMMANDS.includes(command)}`);
                    console.log(`[onRequest] Is command in PUBLIC_BOT_ADMIN_COMMANDS? ${PUBLIC_BOT_ADMIN_COMMANDS.includes(command)}`);
                    console.log(`[onRequest] Is command in PUBLIC_BOT_PUBLIC_COMMANDS? ${PUBLIC_BOT_PUBLIC_COMMANDS.includes(command)}`);
                    
                    // Command handling based on hierarchy: Owner > Bot Admin > Public
                    if (PUBLIC_BOT_OWNER_COMMANDS.includes(command)) {
                        if (isSenderOwner) {
                            switch (command) {
                                case '/addadmin': await handleAddAdminCommand(message, token, env, BOT_KEY); break;
                                case '/deleteadmin': await handleDeleteAdminCommand(message, token, env, BOT_KEY); break;
                                default:
                                    console.log(`[onRequest] Unhandled owner command: ${command}`);
                                    await sendMessage(token, message.chat.id, "မသိသော command ဖြစ်ပါသည်။", 'HTML', null, BOT_KEY);
                                    break;
                            }
                            return new Response("OK", { status: 200 });
                        } else {
                            const userLinkDisplayName = message.from.first_name || message.from.username || "အမည်မသိသူ";
                            const userLink = `<a href="tg://user?id=${message.from.id}"><b>${userLinkDisplayName}</b></a>`;
                            await sendMessage(token, message.chat.id, `${userLink} <b>🚫 "I'm sorry, you don't have permission to use this command! This command is for Owners only! 👱‍♂️</b>`, 'HTML', null, BOT_KEY);
                            return new Response("OK - Unauthorized owner command access", { status: 200 });
                        }
                    } else if (PUBLIC_BOT_ADMIN_COMMANDS.includes(command)) {
                        if (isSenderBotAdmin) {
                             switch (command) {
                                case '/deleteuser':
                                    console.log("[onRequest] Handling /deleteuser command.");
                                    const parts = message.text.split(' ');
                                    if (parts.length === 2) {
                                        const userIdToDelete = parts[1];
                                        const success = await deleteUserData(userIdToDelete, env);
                                        if (success) { await sendMessage(token, message.chat.id, `User data for ID <b>${userIdToDelete}</b> has been deleted from KV Store.`, 'HTML', null, BOT_KEY); }
                                        else { await sendMessage(token, message.chat.id, `Failed to delete user data for ID <b>${userIdToDelete}</b>.`, 'HTML', null, BOT_KEY); }
                                    } else { await sendMessage(token, message.chat.id, "Usage: <code>/deleteuser &lt;user_id&gt;</code>", 'HTML', null, BOT_KEY); }
                                    break;
                                case '/ban':
                                    console.log("[onRequest] Handling /ban command.");
                                    if (message.chat.type === "group" || message.chat.type === "supergroup") {
                                        const args = message.text.split(' ');
                                        // NEW LOGIC: If second arg is a number, it's an ID. Otherwise, it's a reply-based ban.
                                        if (args.length >= 2 && !isNaN(parseInt(args[1]))) {
                                            await handleBanCommandById(message, token, env, BOT_KEY);
                                        } else {
                                            await handleReplyBanCommand(message, token, env, BOT_KEY);
                                        }
                                    } else { await sendMessage(token, message.chat.id, "This command can only be used in groups.", 'HTML', null, BOT_KEY); }
                                    break;
                                case '/mute':
                                    console.log("[onRequest] Handling /mute command.");
                                    if (message.chat.type === "group" || message.chat.type === "supergroup") {
                                        // Both reply-based and ID-based are handled inside handleMuteCommandById
                                        await handleMuteCommandById(message, token, env, BOT_KEY);
                                    } else { await sendMessage(token, message.chat.id, "This command can only be used in groups.", 'HTML', null, BOT_KEY); }
                                    break;
                                case '/banlist':
                                    console.log("[onRequest] Handling /banlist command.");
                                    if (message.chat.type === "group" || message.chat.type === "supergroup") {
                                        await handleBanListCommand(message, token, env, BOT_KEY);
                                    } else { await sendMessage(token, message.chat.id, "This command can only be used in groups.", 'HTML', null, BOT_KEY); }
                                    break;
                                case '/setkey': await handleSetContentCommand(message, token, env, 'key', BOT_KEY); break;
                                case '/setfile': await handleSetContentCommand(message, token, env, 'file', BOT_KEY); break;
                                case '/setphoto': await handleSetContentCommand(message, token, env, 'photo', BOT_KEY); break;
                                case '/key': await handleGetContentCommand(message, token, env, 'key', BOT_KEY); break;
                                case '/file': await handleGetContentCommand(message, token, env, 'file', BOT_KEY); break;
                                case '/photo': await handleGetContentCommand(message, token, env, 'photo', BOT_KEY); break;
                                case '/getcombined': 
                                case '/gc': 
                                    await handleGetCombinedCommand(message, token, env, BOT_KEY); 
                                    break; 
                                case '/deletekey': await handleDeleteContentCommand(message, token, env, 'key', BOT_KEY); break;
                                case '/deletefile': await handleDeleteContentCommand(message, token, env, 'file', BOT_KEY); break;
                                case '/deletephoto': await handleDeleteContentCommand(message, token, env, 'photo', BOT_KEY); break;
                                case '/summarize': 
                                    const requestOrigin = url.origin; 
                                    await handleSummarizeCommand(message, token, env, requestOrigin, BOT_KEY); 
                                    break; 
                                case '/deletesummary': 
                                    await handleDeleteSummaryCommand(message, token, env, BOT_KEY);
                                    break;
                                case '/info': await handleInfoCommand(message, token, env, BOT_KEY); break; 
                                case '/warn': await handleWarnCommand(message, token, env, BOT_KEY); break; 
                                case '/unwarn': await handleUnwarnCommand(message, token, env, BOT_KEY); break; 
                                case '/warnings': await handleWarningsCommand(message, token, env, BOT_KEY); break; 
                                case '/check': await handleCheckUrlCommand(message, token, env, BOT_KEY); break; 
                                case '/setmmkoffset': await handleSetMMKOffsetCommand(message, token, env, BOT_KEY); break; 
                                case '/setthboffset': await handleSetTHBOffsetCommand(message, token, env, BOT_KEY); break; 
                                default:
                                    console.log(`[onRequest] Unhandled general admin command: ${command}`);
                                    await sendMessage(token, message.chat.id, "မသိသော command ဖြစ်ပါသည်။", 'HTML', null, BOT_KEY);
                                    break;
                            }
                            return new Response("OK", { status: 200 });
                        } else {
                             const userLinkDisplayName = message.from.first_name || message.from.username || "အမည်မသိသူ";
                             const userLink = `<a href="tg://user?id=${message.from.id}"><b>${userLinkDisplayName}</b></a>`;
                             await sendMessage(token, message.chat.id, `${userLink} <b>🚫 "I'm sorry, you don't have permission to use this command! Please request what you need! 👱‍♂️</b>`, 'HTML', null, BOT_KEY);
                             return new Response("OK - Unauthorized admin command access", { status: 200 });
                        }
                    } else if (PUBLIC_BOT_PUBLIC_COMMANDS.includes(command)) { 
                        switch (command) {
                            case '/start': await handleStartCommand(message, token, BOT_KEY); break;
                            case '/id': await handleIdCommand(message, token, env, BOT_KEY); break; 
                            case '/listadmin': await handleListAdminCommand(message, token, env, BOT_KEY); break;
                            case '/forex': await handleForexCommand(message, token, env, BOT_KEY); break;
                            case '/rate': await handleForexCommand(message, token, env, BOT_KEY); break;
                            case '/fake':      // NEW: Real address generator
                            case '/address':   // NEW: Real address generator (alias)
                                await handleRealAddressCommand(message, token, BOT_KEY); 
                                break;
                            default:
                                console.log(`[onRequest] Unhandled public command: ${command}`);
                                await sendMessage(token, message.chat.id, "မသိသော command ဖြစ်ပါသည်။", 'HTML', null, BOT_KEY);
                                break;
                        }
                        return new Response("OK", { status: 200 });
                    } else {
                        console.log(`[onRequest] Ignoring non-owner, non-admin, non-public command: ${command}`);
                    }
                }
                if (message.from && message.chat && (message.chat.type === "group" || message.chat.type === "supergroup")) {
                    console.log("[onRequest] Checking for name change (message update)." );
                    await handleMessageUpdateForNameChange(message, token, env, BOT_KEY, context);
                }
            } else if (update.callback_query) {
                console.log("[onRequest] Handling callback_query update.");
                await handleCallbackQuery(update.callback_query, token, env, BOT_KEY);
            } else if (update.my_chat_member) {
                console.log("[onRequest] Handling my_chat_member update.");
                const myChatMember = update.my_chat_member;
                const chat = myChatMember.chat;
                const newChatMember = myChatMember.new_chat_member;

                const botInfo = await getMe(token, BOT_KEY);
                if (botInfo && newChatMember.status === 'member' && newChatMember.user.is_bot && newChatMember.user.id === botInfo.id) {
                    if (chat.type === 'group' || chat.type === 'supergroup') {
                        await sendMessage(token, chat.id, "မင်္ဂလာပါ!", 'HTML', null, BOT_KEY);
                    }
                } else if (newChatMember.status === 'kicked' || newChatMember.status === 'left') {
                    console.log(`[onRequest] Bot was removed from chat: ${chat.title || chat.id}`);
                }
            } else {
                console.log("[onRequest] Unhandled update type:", JSON.stringify(update, null, 2));
            }

            return new Response("OK", { status: 200 });
        } catch (error) {
            console.error("[onRequest] Error handling Telegram webhook:", error.stack || error.message);
            return new Response(`Error: ${error.message}`, { status: 500 });
        }
    } else {
        console.log(`[onRequest] Non-POST/non-webhook-registration request received: ${request.method} ${url.pathname}`);
        return new Response("This is a Telegram bot webhook endpoint. Please send POST requests or access /registerWebhook or /unregisterWebhook or /summary/<id>.", { status: 200 });
    }
}
