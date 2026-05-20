// Wires up the user avatar dropdown on teams and tracker pages.
// Loaded as a plain script (like theme.js) after the matching HTML is in the DOM.
// Sign-out is frontend-only for now: navigates to login.html without calling the API.

const userSwitch = document.getElementById('userSwitch');
const userAvatar = document.getElementById('userAvatar');
const userDropdown = document.getElementById('userDropdown');
const signOutBtn = document.getElementById('signOutBtn');

// Pages without the user menu (login, signup, etc.) skip setup entirely.
if (userSwitch && userAvatar && userDropdown && signOutBtn) {
	/**
	 *
	 * @param open
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
