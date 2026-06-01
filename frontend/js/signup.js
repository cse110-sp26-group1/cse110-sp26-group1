import { createAccount, login, requireNoAuth, getPostAuthRedirect } from './api.js';
import { saveStoredUser, userFromApiProfile } from './user-profile.js';
import { initPasswordToggles } from './view-password.js';

requireNoAuth();
initPasswordToggles(); // wires up the eye button next to the password field

const authForm = document.getElementById('auth-form');
const loginLink = document.querySelector('.auth-switch a');
const redirectParam = new URLSearchParams(location.search).get('redirect');

const firstEl = document.getElementById('first-name');
const lastEl = document.getElementById('last-name');
const usernameEl = document.getElementById('username');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');

if (loginLink && redirectParam) {
	loginLink.href = `login.html?redirect=${encodeURIComponent(redirectParam)}`;
}

/**
 * Handles create-account form submit. Registers the user, then immediately
 * logs in to obtain a session token before redirecting to teams.
 *
 * @param {SubmitEvent} e Browser submit event from the signup form.
 */
async function handleSignupSubmit(e) {
	e.preventDefault();

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
		// Until then, a second login call keeps the signup flow consistent
		// with normal session storage on the login page.
		const { token, expires_at, user } = await login(email, password);

		localStorage.setItem('allegro_token', token);
		localStorage.setItem('allegro_token_expires', expires_at);

		if (user) {
			saveStoredUser(userFromApiProfile(user));
		} else {
			saveStoredUser({ first_name, last_name, username, email });
		}

		location.href = getPostAuthRedirect();
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
// Browser custom validity persists until explicitly cleared.
usernameEl.addEventListener('input', () => usernameEl.setCustomValidity(''));
passwordEl.addEventListener('input', () => passwordEl.setCustomValidity(''));
