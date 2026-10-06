// realAddressApiGenerator.js
// This file calls the custom fake address API deployed at Cloudflare Workers.
// API URL: https://address-api.baegyee404.workers.dev
// Supports 40 countries with real cities and streets.

// Custom API base URL
const API_BASE_URL = 'https://address-api.baegyee404.workers.dev';

// Timeout for API requests (in milliseconds)
const API_TIMEOUT_MS = 10000;

// List of countries supported by the API
export const API_SUPPORTED_COUNTRIES = [
    'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'MM', 'TH', 'SG',
    'IT', 'ES', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'NZ', 'TR',
    'AE', 'SA', 'PK', 'BD', 'LK', 'NP', 'MY', 'ID', 'PH', 'VN',
    'KR', 'CN', 'IN', 'BR', 'RU', 'ZA', 'NL', 'BE', 'MX', 'AR'
];

/**
 * Checks if the API supports a country.
 * @param {string} countryCode - The country code to check.
 * @returns {boolean} - True if API supports it.
 */
export function isApiSupported(countryCode) {
    return API_SUPPORTED_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Gets the list of countries supported by the API.
 * @returns {Array<string>} - Array of country codes.
 */
export function getApiSupportedCountries() {
    return [...API_SUPPORTED_COUNTRIES];
}

/**
 * Fetches a real address from the custom API.
 * @param {string} countryCode - The country code (e.g., 'US', 'MM').
 * @returns {Promise<object|null>} - Address object or null if failed.
 */
export async function fetchRealAddressFromApi(countryCode) {
    const code = countryCode.toUpperCase();
    
    if (!isApiSupported(code)) {
        console.log(`[fetchRealAddressFromApi] Country ${code} not supported by API.`);
        return null;
    }
    
    const apiUrl = `${API_BASE_URL}/api/address?code=${code}`;
    
    try {
        console.log(`[fetchRealAddressFromApi] Fetching from API: ${apiUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.warn(`[fetchRealAddressFromApi] API returned HTTP ${response.status}`);
            return null;
        }
        
        const result = await response.json();
        
        if (!result.success || !result.data) {
            console.warn(`[fetchRealAddressFromApi] Invalid API response structure.`);
            return null;
        }
        
        const data = result.data;
        
        // Map API response to our standard address format
        return {
            street: data.street_address || 'N/A',
            streetName: (data.street_address || '').replace(/^\d+\s*/, '') || 'N/A',
            currency: data.currency || 'USD',
            fullName: data.person_name || 'N/A',
            city: data.city || 'N/A',
            gender: data.gender || 'N/A',
            postalCode: data.postal_code || 'N/A',
            phoneNumber: data.phone_number || 'N/A',
            state: data.state || 'N/A',
            country: data.country || code,
            countryCode: data.country_code || code,
            flag: data.flag || '🏳️',
            email: data.email || 'N/A',
            dateOfBirth: data.date_of_birth || 'N/A',
            password: data.password || 'N/A',
            source: 'API'
        };
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[fetchRealAddressFromApi] Request timed out after ${API_TIMEOUT_MS}ms.`);
        } else {
            console.error(`[fetchRealAddressFromApi] Error:`, error.message);
        }
        return null;
    }
}

/**
 * Fetches the list of supported countries from the API (metadata).
 * @returns {Promise<Array<object>|null>} - Array of country objects or null.
 */
export async function fetchApiCountryList() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/countries`);
        if (!response.ok) return null;
        const result = await response.json();
        return result.countries || null;
    } catch (error) {
        console.error('[fetchApiCountryList] Error:', error.message);
        return null;
    }
}
