import { createAccount, login } from './api.js';

const authForm = document.getElementById('authForm');

/**
 * Handles create-account form submit. Registers the user, then immediately
 * logs in to obtain a session token before redirecting to teams.
 *
 * @param {SubmitEvent} e
 */
async function handleSignupSubmit(e) {
	e.preventDefault();

	const firstEl = document.getElementById('first');
	const lastEl = document.getElementById('last');
	const usernameEl = document.getElementById('username');
	const emailEl = document.getElementById('email');
	const passwordEl = document.getElementById('password');

	const first_name = firstEl.value.trim();
	const last_name = lastEl.value.trim();
	const username = usernameEl.value.trim();
	const email = emailEl.value.trim();
	const password = passwordEl.value;

	if (!first_name) {
		firstEl.focus();
		return;
	}
	if (!last_name) {
		lastEl.focus();
		return;
	}
	if (!username) {
		usernameEl.focus();
		return;
	}
	if (!email) {
		emailEl.focus();
		return;
	}
	if (!password) {
		passwordEl.focus();
		return;
	}

	try {
		await createAccount({ username, first_name, last_name, email, password });

		// temp code since the signup endpoint does not return a token
		// fix once the endpoint is fixed
		const { token, expires_at } = await login(email, password);

		localStorage.setItem('allegro_token', token);
		localStorage.setItem('allegro_token_expires', expires_at);

		localStorage.setItem(
			'allegro_user',
			JSON.stringify({
				initials: (first_name[0] + last_name[0]).toUpperCase(),
				name: `${first_name} ${last_name}`,
				username,
			}),
		);

		location.href = 'teams.html';
	} catch (err) {
		if (err.message?.includes('409')) {
			usernameEl.setCustomValidity('Username or email is already in use');
			usernameEl.reportValidity();
		} else {
			passwordEl.setCustomValidity(err.message ?? 'Sign-up failed');
			passwordEl.reportValidity();
		}
	}
}

authForm.addEventListener('submit', handleSignupSubmit);

// reset validity so user can try again
usernameEl.addEventListener('input', () => usernameEl.setCustomValidity(''));
passwordEl.addEventListener('input', () => passwordEl.setCustomValidity(''));
