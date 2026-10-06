// constants.js
// This file defines all global constants used across the bot.

/**
 * @constant {string} TELEGRAM_API - Base URL for the Telegram Bot API.
 */
export const TELEGRAM_API = "https://api.telegram.org/bot";

/**
 * @constant {string} ADMIN_USERNAME - Telegram Username of the bot developer/admin.
 * (REPLACE WITH YOUR ACTUAL TELEGRAM USERNAME)
 */
export const ADMIN_USERNAME = "@Zero_Free_Vpn"; 

/**
 * @constant {string} SUPPORT_GROUP_LINK - Telegram Support Group Link.
 * (REPLACE WITH YOUR ACTUAL SUPPORT GROUP LINK)
 */
export const SUPPORT_GROUP_LINK = "https://t.me/zero_freevpn"; 

/**
 * @constant {Array<number>} OWNER_ADMIN_IDS - Telegram User IDs of bot owners/admins for this Public User Bot - Pre-filled with user's provided ID
 * These IDs will be able to use the /setkey, /ban etc. commands on THIS bot.
 * (REPLACE WITH YOUR OWN TELEGRAM USER IDs)
 * * NOTE: This array is now primarily for initial setup. For dynamic admin management,
 * the bot will use ADMIN_IDS_KV. You can remove IDs from here after initial deployment
 * and use /addadmin, /deleteadmin commands.
 */
export const OWNER_ADMIN_IDS = [7576434717, 7240495054]; 

/**
 * @constant {Array<string>} BLOCKED_DOMAINS - List of website domains to automatically mute users for (e.g., Games/Shopping).
 */
export const BLOCKED_DOMAINS = [
    "temu.com", "shein.com", "shopee.com", "aliexpress.com", "wish.com", "lazada.com", "daraz.pk",
    "gameloop.com", "bluestacks.com", "fortnite.com", "roblox.com", "minecraft.net", "garena.com",
    "pubgmobile.com", "callofduty.com", "clashofclans.com", "mobilelegends.com",
    "genshinimpact.mihoyo.com", "freefire.com",
    "fivestarskm.com", // Example gambling site
    "fivestarskm777.t.me", // Specific Telegram channel link
    "facebook.com/profile.php?id=100075308733678", // Example specific gambling Facebook profile
    // နောက်ထပ် mute လုပ်ချင်တဲ့ လင့်များထပ်ထည့်ရန်
];

/**
 * @constant {Array<string>} BLOCKED_APP_IDS - Play Store နှင့် Apple App Store မှ Mute လုပ်မည့် Specific App IDs များ
 */
export const BLOCKED_APP_IDS = [
    "com.einnovation.temu", // Temu
    "com.zhiliaoapp.musically", // TikTok (often associated with e-commerce)
    "com.shein.sheinlive", // Shein
    "com.lazada.android", // Lazada
    "com.shopee.th", // Shopee (example, can be specific to country)
    "com.alibaba.aliexpresshd", // AliExpress
    "com.contextlogic.wish", // Wish
    "com.beeasy.airpay", // Shopeepay

    "com.tencent.ig", // PUBG Mobile
    "com.garena.game.kgid", // Garena Free Fire
    "com.mojang.minecraftpe", // Minecraft
    "com.roblox.client", // Roblox
    "com.mobile.legends", // Mobile Legends: Bang Bang
    "com.supercell.clashofclans", // Clash of Clans
    "com.activision.callofduty.shooter", // Call of Duty Mobile
    "com.mihoyo.genshinimpact", // Genshin Impact
    "com.garena.game.sm", // Garena (general client if needed)
    // နောက်ထပ် mute လုပ်ချင်တဲ့ App ID များထပ်ထည့်ရန်
];

/**
 * @constant {Array<RegExp>} BLOCKED_KEYWORDS_REGEX - အလိုအလျောက် Mute လုပ်မည့် Keywords များ စာရင်း (Case-insensitive)
 */
export const BLOCKED_KEYWORDS_REGEX = [
    /\b2D\b/i, /\b3D\b/i,
    // နောက်ထပ် mute လုပ်ချင်တဲ့ Keyword များထပ်ထည့်ရန်
];


/**
 * @constant {Array<string>} PUBLIC_BOT_OWNER_COMMANDS - Commands strictly for Bot Owners only.
 */
export const PUBLIC_BOT_OWNER_COMMANDS = [
    '/addadmin', 
    '/deleteadmin'
];

/**
 * @constant {Array<string>} PUBLIC_BOT_ADMIN_COMMANDS - Commands for general Admins (including Owners).
 * Added /warn, /unwarn, /warnings for the new warning system.
 * Added /checkurl for URL safety checking.
 * Added /setmmkoffset for MMK offset configuration.
 * Added /setthboffset for THB offset configuration.
 * Added /deletesummary for deleting chat history.
 * Added /banlist for viewing all banned users in the group.
 */
export const PUBLIC_BOT_ADMIN_COMMANDS = [
    '/setkey', '/setfile', '/setphoto', 
    '/key', '/file', '/photo', '/getcombined', '/gc', 
    '/deletekey', '/deletefile', '/deletephoto', 
    '/deleteuser', '/ban', '/mute',
    '/summarize',
    '/deletesummary', 
    '/info',
    '/warn', 
    '/unwarn', 
    '/warnings',
    '/check',
    '/setmmkoffset', 
    '/setthboffset',
    '/banlist' // NEW: View banned users list
];

/**
 * @constant {Array<string>} PUBLIC_BOT_PUBLIC_COMMANDS - Commands accessible by all users.
 * Added /forex for real-time exchange rates.
 * Added /fake and /address for real address generation.
 */
export const PUBLIC_BOT_PUBLIC_COMMANDS = [
    '/start',
    '/id', 
    '/listadmin',
    '/forex',
    '/rate',
    '/fake',      // NEW: Real address generator
    '/address'    // NEW: Real address generator (alias)
];

/**
 * @constant {string} CONTROL_BOT_URL - URL of the main control bot for license validation.
 * (REPLACE WITH YOUR ACTUAL CONTROL BOT'S URL)
 */
export const CONTROL_BOT_URL = `https://master-control.pages.dev/`; 

/**
 * @constant {string} GOOGLE_SAFE_BROWSING_API_KEY - API Key for Google Safe Browsing API.
 * (REPLACE WITH YOUR ACTUAL GOOGLE SAFE BROWSING API KEY)
 * Get one from Google Cloud Console: https://console.cloud.google.com/apis/credentials
 */
export const GOOGLE_SAFE_BROWSING_API_KEY = "AIzaSyCGRx463eYzIHAG7cMLFhFPdQ8EwCXuPDI"; 

/**
 * @constant {Object<number, Date>} FIXED_ACCOUNT_CREATION_DATES - Fixed creation dates for specific user IDs.
 * Used for accurate calculation of account age for known IDs.
 * Format: { userId: new Date(year, monthIndex, day) }
 * Note: monthIndex is 0-based (January is 0, December is 11)
 */
export const FIXED_ACCOUNT_CREATION_DATES = {
    // Corrected dates based on "4 years, 7 months, 20 days" before July 22, 2025 (which is December 2, 2020)
    7576434717: new Date(2020, 11, 2), // December 2, 2020
    7240495054: new Date(2020, 11, 2), // December 2, 2020
};
