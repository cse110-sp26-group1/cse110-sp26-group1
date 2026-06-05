import { createAccount, login, requireNoAuth, getPostAuthRedirect } from './api.js';
import { saveStoredUser, userFromApiProfile } from './user-profile.js';
import { initPasswordToggles } from './helpers.js';

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

const errorEl = document.getElementById('auth-error');
const submitBtn = document.getElementById('submit-btn');

/**
 * Handles create-account form submit. Registers the user, then immediately
 * logs in to obtain a session token before redirecting to teams.
 *
 * @param {SubmitEvent} e Browser submit event from the signup form.
 */
async function handleSignupSubmit(e) {
	e.preventDefault();
	errorEl.hidden = true; // Clear previous errors

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

	const originalText = submitBtn.textContent;
	submitBtn.textContent = 'Creating account...';
	submitBtn.disabled = true;

	try {
		const { token, expires_at, user } = await createAccount({
			username,
			first_name,
			last_name,
			email,
			password,
		});

		localStorage.setItem('allegro_token', token);
		localStorage.setItem('allegro_token_expires', expires_at);

		if (user) {
			saveStoredUser(userFromApiProfile(user));
		} else {
			saveStoredUser({ first_name, last_name, username, email });
		}

		location.href = getPostAuthRedirect();
	} catch (err) {
		// Map backend errors to friendly UI copy
		let msg = err.message || 'Sign-up failed. Please try again.';
		if (err.status === 409 || msg.includes('409') || msg.toLowerCase().includes('already in use')) {
			msg = 'That username or email is already in use. Please try another.';
		} else if (err.status === 400 || msg.includes('400')) {
			msg = 'Please check your information and try again.';
		}

		errorEl.textContent = msg;
		errorEl.hidden = false;
	} finally {
		submitBtn.textContent = originalText;
		submitBtn.disabled = false;
	}
}

authForm.addEventListener('submit', handleSignupSubmit);

// Hide the error banner as soon as they start typing to fix their mistake
authForm.querySelectorAll('.input').forEach((input) => {
	input.addEventListener('input', () => (errorEl.hidden = true));
});
