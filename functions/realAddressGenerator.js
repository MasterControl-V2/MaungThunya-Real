// realAddressGenerator.js
// This file generates real addresses using the custom API.
// API URL: https://address-api.baegyee404.workers.dev
// Fallback: If API fails, returns an error (no local data fallback).

import { 
    fetchRealAddressFromApi, 
    isApiSupported, 
    getApiSupportedCountries,
    API_SUPPORTED_COUNTRIES 
} from './realAddressApiGenerator.js';

/**
 * Gets the list of supported country codes.
 * @returns {Array<string>} - Array of country codes.
 */
export function getSupportedCountries() {
    return [...API_SUPPORTED_COUNTRIES].sort();
}

/**
 * Checks if a country code is supported.
 * @param {string} countryCode - The country code to check.
 * @returns {boolean} - True if supported.
 */
export function isCountrySupported(countryCode) {
    return isApiSupported(countryCode);
}

/**
 * Gets the full country info (minimal — API provides data).
 * @param {string} countryCode - The country code.
 * @returns {object|null} - Country info object or null.
 */
export function getCountryInfo(countryCode) {
    const code = countryCode.toUpperCase();
    if (!isApiSupported(code)) return null;
    return { code, source: 'API' };
}

/**
 * Generates a real address for a given country by calling the API.
 * 
 * @param {string} countryCode - The 2-letter country code (e.g., 'US', 'MM', 'TH').
 * @returns {Promise<object|null>} - Address object or null if failed.
 */
export async function generateRealAddress(countryCode) {
    const code = countryCode.toUpperCase();
    
    // Check if country is supported
    if (!isCountrySupported(code)) {
        console.error(`[generateRealAddress] Country code ${code} is not supported.`);
        return null;
    }
    
    // Fetch from API
    console.log(`[generateRealAddress] Fetching address for ${code} from API...`);
    const address = await fetchRealAddressFromApi(code);
    
    if (!address) {
        console.error(`[generateRealAddress] API failed to return address for ${code}.`);
        return null;
    }
    
    console.log(`[generateRealAddress] ✅ Successfully generated address for ${code}.`);
    return address;
}

// Log total supported countries
console.log(`[realAddressGenerator] Total supported countries (API): ${getSupportedCountries().length}`);
