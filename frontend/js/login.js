import { login, requireNoAuth, getPostAuthRedirect } from './api.js';
import { saveStoredUser, userFromApiProfile } from './user-profile.js';
import { initPasswordToggles } from './helpers.js';

requireNoAuth();
initPasswordToggles();

const authForm = document.getElementById('auth-form');
const signupLink = document.querySelector('.auth-switch a');
const redirectParam = new URLSearchParams(location.search).get('redirect');

const errorEl = document.getElementById('auth-error');
const submitBtn = document.getElementById('submit-btn');

if (signupLink && redirectParam) {
	signupLink.href = `signup.html?redirect=${encodeURIComponent(redirectParam)}`;
}

/**
 * Handles sign-in form submit. Validates email and password, then
 * redirects to the teams page.
 *
 * @param {SubmitEvent} e Form submit event.
 */
async function handleLoginSubmit(e) {
	e.preventDefault();
	errorEl.hidden = true;

	const emailEl = document.getElementById('email');
	const passwordEl = document.getElementById('password');

	const email = emailEl.value.trim();
	const password = passwordEl.value;

	if (!email || !password) {
		if (!email) emailEl.focus();
		else passwordEl.focus();
		return;
	}

	const originalText = submitBtn.textContent;
	submitBtn.textContent = 'Signing in...';
	submitBtn.disabled = true;

	try {
		const { token, expires_at, user } = await login(email, password);

		localStorage.setItem('allegro_token', token);
		localStorage.setItem('allegro_token_expires', expires_at);
		if (user) saveStoredUser(userFromApiProfile(user));

		location.href = getPostAuthRedirect();
	} catch (err) {
		// Map backend errors to friendly UI copy
		let msg = err.message || 'Failed to sign in. Please try again.';
		if (err.status === 401 || err.status === 404 || msg.toLowerCase().includes('invalid')) {
			msg = 'Invalid email or password. Please try again.';
		}

		errorEl.textContent = msg;
		errorEl.hidden = false;
		passwordEl.value = '';
		passwordEl.focus();
	} finally {
		submitBtn.textContent = originalText;
		submitBtn.disabled = false;
	}
}

authForm.addEventListener('submit', handleLoginSubmit);

// Hide the error banner as soon as they start typing again
document.getElementById('email').addEventListener('input', () => (errorEl.hidden = true));
document.getElementById('password').addEventListener('input', () => (errorEl.hidden = true));
