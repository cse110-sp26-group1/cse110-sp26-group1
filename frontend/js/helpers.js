/**
 * Initializes visibility toggle buttons for password inputs.
 * @returns {void}
 */
export function initPasswordToggles() {
	document.querySelectorAll('.password-wrapper').forEach((wrapper) => {
		const input = wrapper.querySelector('.password-input');
		const toggle = wrapper.querySelector('.password-toggle');
		if (!input || !toggle) return;

		/**
		 * Synchronizes the password input and toggle state.
		 *
		 * @param {boolean} shouldShow whether the password should be visible.
		 */
		const render = (shouldShow) => {
			input.type = shouldShow ? 'text' : 'password';
			toggle.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
			toggle.setAttribute('aria-pressed', String(shouldShow));
		};

		render(input.type === 'text');

		// css swaps between the show and hide password icons
		toggle.addEventListener('click', () => {
			render(input.type === 'password');
		});
	});
}

const THEME_KEY = 'theme';

/**
 * Persists the user's light/dark choice and wires up #theme-toggle.
 * The head FOUC script in each HTML page applies the saved class before paint;
 * this keeps state in sync after load.
 * @returns {void}
 */
export function initTheme() {
	const root = document.documentElement;

	try {
		if (localStorage.getItem(THEME_KEY) === 'dark') {
			root.classList.add('dark');
		}
	} catch {
		// localStorage unavailable (private mode, sandboxed iframe, etc.)
	}

	const btn = document.getElementById('theme-toggle');
	if (!btn) return;

	btn.addEventListener('click', () => {
		const next = root.classList.contains('dark') ? 'light' : 'dark';
		root.classList.toggle('dark', next === 'dark');
		try {
			localStorage.setItem(THEME_KEY, next);
		} catch {
			// localStorage unavailable
		}
	});
}

/**
 * Parses a raw API timestamp into a valid Date object.
 * @param {string | null | undefined} value Timestamp string.
 * @returns {Date | null}
 */
export function parseTimestamp(value) {
	if (!value) return null;
	const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date string to a smart relative format (Today, Yesterday, or MMM D, YYYY).
 * @param {string | null | undefined} value Timestamp string.
 * @returns {string}
 */
export function formatRelativeDate(value) {
	const date = parseTimestamp(value);
	if (!date) return value || '-';

	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayDiff = Math.round((startOfToday - startOfDate) / 86400000);

	if (dayDiff === 0) return 'Today';
	if (dayDiff === 1) return 'Yesterday';

	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/**
 * Formats a date string to a full date and time.
 * @param {string | null | undefined} value Timestamp string.
 * @returns {string}
 */
export function formatDateTime(value) {
	const date = parseTimestamp(value);
	if (!date) return value || '';

	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
}

/**
 * Escape user/LLM text before inserting into HTML.
 * @param {string} text Raw text to escape.
 * @returns {string}
 */
export function escapeHtml(text) {
	return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Derives a two-letter team mark from a team name.
 * @param {string} teamName Team display name.
 * @returns {string}
 */
export function getTeamMark(teamName) {
	const trimmed = teamName.trim();
	const words = trimmed.split(' ');
	return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : trimmed.substring(0, 2).toUpperCase();
}

/**
 * Show a short-lived toast notification.
 * @param {string} msg Message to display.
 * @param {HTMLElement | null} [toastEl] Toast element; defaults to #toast.
 * @returns {void}
 */
export function showToast(msg, toastEl = document.getElementById('toast')) {
	if (!toastEl) return;
	toastEl.textContent = msg;
	toastEl.classList.add('show');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

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
 * Reads the cached user profile from localStorage.
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
 * @param {StoredUser | null | undefined} [user] User.
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
 * Returns a display name for the stored user.
 * @param {StoredUser | null | undefined} [user] User.
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
 * @param {StoredUser} profile User data to save.
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
 * @param {{ first_name?: string, last_name?: string, username?: string, email?: string }} apiUser API payload.
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

/**
 * Clears stored auth credentials.
 * @returns {void}
 */
export function clearAuth() {
	localStorage.removeItem('allegro_token');
	localStorage.removeItem('allegro_user');
	localStorage.removeItem('allegro_token_expires');
}

/**
 * Wires up the user avatar dropdown on teams and tracker pages.
 * @returns {void}
 */
export function initUserMenu() {
	const userSwitch = document.getElementById('user-switch');
	const userAvatar = document.getElementById('user-avatar');
	const userDropdown = document.getElementById('user-dropdown');
	const signOutBtn = document.getElementById('sign-out-btn');

	if (userAvatar) {
		userAvatar.textContent = getUserInitials();
		userAvatar.title = getUserDisplayName();
	}

	if (!userSwitch || !userAvatar || !userDropdown || !signOutBtn) return;

	/**
	 * Toggles dropdown visibility and aria-expanded on the avatar.
	 * @param {boolean} open - Whether the menu should be open.
	 */
	function setOpen(open) {
		userDropdown.classList.toggle('open', open);
		userAvatar.setAttribute('aria-expanded', open ? 'true' : 'false');
	}

	userAvatar.addEventListener('click', (e) => {
		e.stopPropagation();
		const opening = !userDropdown.classList.contains('open');
		if (opening) {
			document.dispatchEvent(new CustomEvent('topbar:open', { detail: 'user-menu' }));
		}
		setOpen(opening);
	});

	document.addEventListener('topbar:open', (e) => {
		if (e.detail !== 'user-menu') setOpen(false);
	});

	userDropdown.addEventListener('click', (e) => e.stopPropagation());

	document.addEventListener('click', () => setOpen(false));

	signOutBtn.addEventListener('click', () => {
		clearAuth();
		location.href = 'login.html';
	});
}
