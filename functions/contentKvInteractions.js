// contentKvInteractions.js
// This file handles interactions with the PUBLIC_BOT_CONTENT_KV namespace.

/**
 * Stores general content (key, file_id, photo_id) in the PUBLIC_BOT_CONTENT_KV namespace.
 * Data is stored as a JSON string with type, title, description, and content/file_id.
 * @param {string} keyPrefix - 'key', 'file', or 'photo'.
 * @param {string} keyword - The unique keyword for the content.
 * @param {object} data - The object containing title, description, and content/file_id.
 * @param {object} env - The Cloudflare environment object (must have PUBLIC_BOT_CONTENT_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setContentData(keyPrefix, keyword, data, env) {
    const fullKey = `${keyPrefix}:${keyword}`;
    console.log(`[setContentData] Attempting to store data for key: ${fullKey}`);
    if (!env.PUBLIC_BOT_CONTENT_KV) {
        console.error(`[setContentData] PUBLIC_BOT_CONTENT_KV KV namespace is not bound. Cannot store ${keyPrefix} data.`);
        return false;
    }
    try {
        await env.PUBLIC_BOT_CONTENT_KV.put(fullKey, JSON.stringify(data));
        console.log(`[setContentData] Stored ${keyPrefix} data for key: ${fullKey}`);
        return true;
    } catch (error) {
        console.error(`[setContentData] Error storing ${keyPrefix} data for key ${fullKey}:`, error);
        return false;
    }
}

/**
 * Retrieves general content (key, file_id, photo_id) from the PUBLIC_BOT_CONTENT_KV namespace.
 * Data is parsed as a JSON object.
 * @param {string} keyPrefix - 'key', 'file', or 'photo'.
 * @param {string} keyword - The unique keyword for the content.
 * @param {object} env - The Cloudflare environment object (must have PUBLIC_BOT_CONTENT_KV binding).
 * @returns {Promise<object|null>} - The retrieved value as a JSON object, or null if not found or error.
 */
export async function getContentData(keyPrefix, keyword, env) {
    const fullKey = `${keyPrefix}:${keyword}`;
    console.log(`[getContentData] Attempting to retrieve data for key: ${fullKey}`);
    if (!env.PUBLIC_BOT_CONTENT_KV) {
        console.error(`[getContentData] PUBLIC_BOT_CONTENT_KV KV namespace is not bound. Cannot retrieve ${keyPrefix} data.`);
        return null;
    }
    try {
        const value = await env.PUBLIC_BOT_CONTENT_KV.get(fullKey, { type: 'json' });
        console.log(`[getContentData] Retrieved ${keyPrefix} data for key: ${fullKey}: ${JSON.stringify(value)}`);
        return value;
    } catch (error) {
        console.error(`[getContentData] Error retrieving ${keyPrefix} data for key ${fullKey}:`, error);
        return null;
    }
}

/**
 * Deletes general content (key, file_id, photo_id) from the PUBLIC_BOT_CONTENT_KV namespace.
 * @param {string} keyPrefix - 'key', 'file', or 'photo'.
 * @param {string} keyword - The unique keyword for the content.
 * @param {object} env - The Cloudflare environment object (must have PUBLIC_BOT_CONTENT_KV binding).
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function deleteContentData(keyPrefix, keyword, env) {
    const fullKey = `${keyPrefix}:${keyword}`;
    console.log(`[deleteContentData] Attempting to delete data for key: ${fullKey}`);
    if (!env.PUBLIC_BOT_CONTENT_KV) {
        console.error(`[deleteContentData] PUBLIC_BOT_CONTENT_KV KV namespace is not bound. Cannot delete ${keyPrefix} data.`);
        return false;
    }
    try {
        await env.PUBLIC_BOT_CONTENT_KV.delete(fullKey);
        console.log(`[deleteContentData] Deleted ${keyPrefix} data for key: ${fullKey}`);
        return true;
    } catch (error) {
        console.error(`[deleteContentData] Error deleting ${keyPrefix} data for key ${fullKey}:`, error);
        return false;
    }
}

