// Wires up the user avatar dropdown on teams and tracker pages.
// Loaded as a plain script (like theme.js) after the matching HTML is in the DOM.
// Sign-out is frontend-only for now: navigates to login.html without calling the API.

const userSwitch = document.getElementById('user-switch');
const userAvatar = document.getElementById('user-avatar');
const userDropdown = document.getElementById('user-dropdown');
const signOutBtn = document.getElementById('sign-out-btn');

try {
	const user = JSON.parse(localStorage.getItem('allegro_user') ?? '{}');
	if (user.initials && userAvatar) userAvatar.textContent = user.initials;
	if (user.name && userAvatar) userAvatar.title = user.name;
} catch {
	/* stored value malformed */
}

// Pages without the user menu (login, signup, etc.) skip setup entirely.
if (userSwitch && userAvatar && userDropdown && signOutBtn) {
	/**
	 * Toggles dropdown visibility and aria-expanded on the avatar.
	 * @param {boolean} open - Whether the menu should be open.
	 */
	function setOpen(open) {
		userDropdown.classList.toggle('open', open);
		userAvatar.setAttribute('aria-expanded', open ? 'true' : 'false');
	}

	// Toggle on avatar click; stopPropagation so document click does not close immediately.
	userAvatar.addEventListener('click', (e) => {
		e.stopPropagation();
		setOpen(!userDropdown.classList.contains('open'));
	});

	// Clicks inside the menu should not bubble to document (same pattern as team menu).
	userDropdown.addEventListener('click', (e) => e.stopPropagation());

	document.addEventListener('click', () => setOpen(false));

	// No auth API yet — redirect to login page only.
	signOutBtn.addEventListener('click', () => {
		location.href = 'login.html';
	});
}

// Sign Out Button Logic
signOutBtn.addEventListener('click', () => {
	localStorage.removeItem('allegro_token');
	localStorage.removeItem('allegro_user');
	location.href = 'login.html';
});
