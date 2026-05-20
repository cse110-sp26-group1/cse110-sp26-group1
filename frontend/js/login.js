import { login, requireNoAuth } from './api.js';

requireNoAuth();

const authForm = document.getElementById('authForm');

/**
 * Handles sign-in form submit. Validates email and password, then
 * redirects to the teams page. No API call until backend auth is wired.
 *
 * @param {SubmitEvent} e Form submit event.
 */
async function handleLoginSubmit(e) {
	e.preventDefault();
	const emailEl = document.getElementById('email');
	const passwordEl = document.getElementById('password');

	const email = emailEl.value.trim();
	const password = passwordEl.value;

	if (!email || !password) {
		if (!email) emailEl.focus();
		else passwordEl.focus();
		return;
	}

	try {
		const { token, expires_at } = await login(email, password);
		localStorage.setItem('allegro_token', token);
		localStorage.setItem('allegro_token_expires', expires_at);
		location.href = 'teams.html';
	} catch (err) {
		emailEl.setCustomValidity(err.message ?? 'Invalid credentials');
		emailEl.reportValidity();
	}
}

authForm.addEventListener('submit', handleLoginSubmit);
