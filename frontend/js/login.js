import { login, requireNoAuth, getPostAuthRedirect } from './api.js';
import { saveStoredUser, userFromApiProfile } from './user-profile.js';
import { initPasswordToggles } from './view-password.js';

requireNoAuth();
initPasswordToggles();

const authForm = document.getElementById('auth-form');
const signupLink = document.querySelector('.auth-switch a');
const redirectParam = new URLSearchParams(location.search).get('redirect');

if (signupLink && redirectParam) {
	signupLink.href = `signup.html?redirect=${encodeURIComponent(redirectParam)}`;
}

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
		const { token, expires_at, user } = await login(email, password);
		localStorage.setItem('allegro_token', token);
		localStorage.setItem('allegro_token_expires', expires_at);
		if (user) saveStoredUser(userFromApiProfile(user));
		location.href = getPostAuthRedirect();
	} catch (err) {
		emailEl.setCustomValidity(err.message ?? 'Invalid credentials');
		emailEl.reportValidity();
	}
}

authForm.addEventListener('submit', handleLoginSubmit);
