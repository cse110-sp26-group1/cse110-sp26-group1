// Wires up the user avatar dropdown on teams and tracker pages.
import { getUserDisplayName, getUserInitials } from './user-profile.js';

const userSwitch = document.getElementById('user-switch');
const userAvatar = document.getElementById('user-avatar');
const userDropdown = document.getElementById('user-dropdown');
const signOutBtn = document.getElementById('sign-out-btn');

if (userAvatar) {
	userAvatar.textContent = getUserInitials();
	userAvatar.title = getUserDisplayName();
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

	userAvatar.addEventListener('click', (e) => {
		e.stopPropagation();
		setOpen(!userDropdown.classList.contains('open'));
	});

	userDropdown.addEventListener('click', (e) => e.stopPropagation());

	document.addEventListener('click', () => setOpen(false));

	signOutBtn.addEventListener('click', () => {
		localStorage.removeItem('allegro_token');
		localStorage.removeItem('allegro_user');
		location.href = 'login.html';
	});
}
