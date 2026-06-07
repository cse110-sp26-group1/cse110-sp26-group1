/**
 * initializes visibility toggle buttons for password inputs
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
 * Formats a date string to match the issue tracker's smart format.
 * @param {string | null | undefined} value Timestamp string.
 * @returns {string}
 */
export function formatInviteDate(value) {
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
