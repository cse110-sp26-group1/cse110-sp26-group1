const STORAGE_KEY = 'allegro_user';

/**
 * @typedef {object} StoredUser
 * @property {string} [initials]
 * @property {string} [name]
 * @property {string} [username]
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [email]
 */

/**
 * @returns {StoredUser | null}
 */
export function getStoredUser() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const user = JSON.parse(raw);
		return user && typeof user === 'object' ? user : null;
	} catch {
		return null;
	}
}

/**
 * Derives two-letter initials (same rules as tracker sidebar team members).
 * @param {StoredUser | null | undefined} [user]
 * @returns {string}
 */
export function getUserInitials(user = getStoredUser()) {
	if (!user) return '??';

	if (user.initials) return user.initials;

	if (user.first_name && user.last_name) {
		return (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase();
	}

	const identifier = user.username || user.email || '';
	if (identifier) return identifier.substring(0, 2).toUpperCase();

	return '??';
}

/**
 * @param {StoredUser | null | undefined} [user]
 * @returns {string}
 */
export function getUserDisplayName(user = getStoredUser()) {
	if (!user) return 'Account';

	if (user.name) return user.name;

	if (user.first_name && user.last_name) {
		return `${user.first_name} ${user.last_name}`;
	}

	return user.username || user.email || 'Account';
}

/**
 * @param {StoredUser} profile
 * @returns {void}
 */
export function saveStoredUser(profile) {
	const first_name = profile.first_name?.trim() ?? '';
	const last_name = profile.last_name?.trim() ?? '';
	const username = profile.username?.trim() ?? '';
	const email = profile.email?.trim() ?? '';

	const stored = {
		...profile,
		first_name,
		last_name,
		username,
		email,
		initials: profile.initials ?? getUserInitials({ first_name, last_name, username, email }),
		name: profile.name ?? (first_name && last_name ? `${first_name} ${last_name}` : username || email || 'Account'),
	};

	localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Build a stored user object from API login/register user payload.
 * @param {{ first_name?: string, last_name?: string, username?: string, email?: string }} apiUser
 * @returns {StoredUser}
 */
export function userFromApiProfile(apiUser) {
	const first_name = apiUser.first_name?.trim() ?? '';
	const last_name = apiUser.last_name?.trim() ?? '';
	const username = apiUser.username?.trim() ?? '';
	const email = apiUser.email?.trim() ?? '';

	return {
		first_name,
		last_name,
		username,
		email,
		initials: getUserInitials({ first_name, last_name, username, email }),
		name: first_name && last_name ? `${first_name} ${last_name}` : username || email || 'Account',
	};
}
