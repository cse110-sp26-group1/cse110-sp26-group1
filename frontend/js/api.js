// api.js
const API_BASE = '/api'; // Replace with your actual backend URL

/**
 * Core request handler to manage headers, tokens, and errors globally.
 * @param {string} endpoint - The API route (e.g., '/issues')
 * @param {RequestInit} [options] - Fetch options (method, body, headers)
 * @returns {Promise<unknown|null>}
 */
export async function request(endpoint, options = {}) {
	// Retrieve auth token if you are using JWT or similar token-based auth
	const token = localStorage.getItem('allegro_token');

	const headers = { ...options.headers };

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	// Only set Content-Type to application/json if we aren't sending FormData (files).
	// If it is FormData, the browser needs to automatically set the multipart boundary.
	if (!(options.body instanceof FormData) && !headers['Content-Type']) {
		headers['Content-Type'] = 'application/json';
	}

	const config = {
		...options,
		headers,
	};

	try {
		const response = await fetch(`${API_BASE}${endpoint}`, config);

		if (!response.ok) {
			// Try to parse server error messages if available
			let errorMessage = `API Error: ${response.status} ${response.statusText}`;
			try {
				const errorData = await response.json();
				if (errorData.message) errorMessage = errorData.message;
			} catch {
				/* ignore JSON parse error on non-JSON error responses */
			}

			throw new Error(errorMessage);
		}

		// Handle 204 No Content or empty responses safely
		if (response.status === 204) return null;

		return await response.json();
	} catch (error) {
		throw error; // Re-throw to let the UI handle the specific error state
	}
}
