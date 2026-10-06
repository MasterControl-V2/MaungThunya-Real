// forexKvInteractions.js
// This file handles interactions with a KV namespace for Forex settings, specifically the MMK offset.

/**
 * Stores the MMK conversion offset in the FOREX_SETTINGS_KV namespace.
 * This offset is an additional value to be added to the base MMK rate obtained from the external API.
 * @param {number} offset - The numeric offset value (e.g., 10.5, -2.0).
 * @param {object} env - The Cloudflare environment object (must have FOREX_SETTINGS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setMMKOffset(offset, env) {
    if (!env.FOREX_SETTINGS_KV) {
        console.error("[setMMKOffset] FOREX_SETTINGS_KV KV namespace is not bound. Cannot store MMK offset.");
        return false;
    }
    try {
        // Store as a string to ensure consistency, can be parsed back to float
        await env.FOREX_SETTINGS_KV.put("mmk_offset", offset.toString());
        console.log(`[setMMKOffset] MMK offset stored successfully: ${offset}`);
        return true;
    } catch (error) {
        console.error("[setMMKOffset] Error storing MMK offset:", error);
        return false;
    }
}

/**
 * Retrieves the MMK conversion offset from the FOREX_SETTINGS_KV namespace.
 * @param {object} env - The Cloudflare environment object (must have FOREX_SETTINGS_KV binding).
 * @returns {Promise<number>} - The retrieved offset value as a number, or 0 if not found or error.
 */
export async function getMMKOffset(env) {
    if (!env.FOREX_SETTINGS_KV) {
        console.warn("[getMMKOffset] FOREX_SETTINGS_KV KV namespace is not bound. Cannot retrieve MMK offset.");
        return 0; // Default to 0 if KV is not bound
    }
    try {
        const offsetRaw = await env.FOREX_SETTINGS_KV.get("mmk_offset");
        if (offsetRaw) {
            const offset = parseFloat(offsetRaw);
            if (!isNaN(offset)) {
                console.log(`[getMMKOffset] Retrieved MMK offset: ${offset}`);
                return offset;
            }
        }
        console.log("[getMMKOffset] No MMK offset found in KV or invalid value. Returning 0.");
        return 0; // Default to 0 if no offset is set or value is invalid
    } catch (error) {
        console.error("[getMMKOffset] Error retrieving MMK offset:", error);
        return 0; // Default to 0 on error
    }
}

/**
 * Stores the THB conversion offset in the FOREX_SETTINGS_KV namespace.
 * This offset is an additional value to be added to the base THB rate obtained from the external API
 * when converting from MMK to THB. It can be negative for subtraction.
 * @param {number} offset - The numeric offset value (e.g., -0.0024).
 * @param {object} env - The Cloudflare environment object (must have FOREX_SETTINGS_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setTHBOffset(offset, env) {
    if (!env.FOREX_SETTINGS_KV) {
        console.error("[setTHBOffset] FOREX_SETTINGS_KV KV namespace is not bound. Cannot store THB offset.");
        return false;
    }
    try {
        await env.FOREX_SETTINGS_KV.put("thb_offset", offset.toString());
        console.log(`[setTHBOffset] THB offset stored successfully: ${offset}`);
        return true;
    } catch (error) {
        console.error("[setTHBOffset] Error storing THB offset:", error);
        return false;
    }
}

/**
 * Retrieves the THB conversion offset from the FOREX_SETTINGS_KV namespace.
 * @param {object} env - The Cloudflare environment object (must have FOREX_SETTINGS_KV binding).
 * @returns {Promise<number>} - The retrieved offset value as a number, or 0 if not found or error.
 */
export async function getTHBOffset(env) {
    if (!env.FOREX_SETTINGS_KV) {
        console.warn("[getTHBOffset] FOREX_SETTINGS_KV KV namespace is not bound. Cannot retrieve THB offset.");
        return 0; // Default to 0 if KV is not bound
    }
    try {
        const offsetRaw = await env.FOREX_SETTINGS_KV.get("thb_offset");
        if (offsetRaw) {
            const offset = parseFloat(offsetRaw);
            if (!isNaN(offset)) {
                console.log(`[getTHBOffset] Retrieved THB offset: ${offset}`);
                return offset;
            }
        }
        console.log("[getTHBOffset] No THB offset found in KV or invalid value. Returning 0.");
        return 0; // Default to 0 if no offset is set or value is invalid
    } catch (error) {
        console.error("[getTHBOffset] Error retrieving THB offset:", error);
        return 0; // Default to 0 on error
    }
}

