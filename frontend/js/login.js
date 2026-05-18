import { login } from './mock-api.js';

const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const body = document.body;

const authForm = document.getElementById('authForm');
const submitBtn = document.getElementById('submitBtn');

/**
 * Switches the auth form between login and signup modes.
 *
 * @param {string} mode Selected auth mode.
 */
function setMode(mode) {
	body.classList.toggle('mode-login', mode === 'login');
	body.classList.toggle('mode-signup', mode === 'signup');
	tabLogin.classList.toggle('on', mode === 'login');
	tabSignup.classList.toggle('on', mode === 'signup');
	tabLogin.setAttribute('aria-selected', String(mode === 'login'));
	tabSignup.setAttribute('aria-selected', String(mode === 'signup'));
}
tabLogin.addEventListener('click', () => setMode('login'));
tabSignup.addEventListener('click', () => setMode('signup'));

// submit → teams page (prototype — real auth wiring happens in the backend integration)
document.getElementById('authForm').addEventListener('submit', (e) => {
	e.preventDefault();
	const emailEl = document.getElementById('email');
	const email = emailEl.value.trim();
	if (!email) {
		emailEl.focus();
		return;
	}
	location.href = 'teams.html';
});

authForm.addEventListener('submit', async (e) => {
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

	const originalText = submitBtn.textContent;
	submitBtn.textContent = 'Authenticating...';
	submitBtn.disabled = true;

	try {
		await login(email, password);

		location.href = 'teams.html';
	} catch (err) {
		console.error(err);
		alert('Login failed. Please check your credentials.');
		submitBtn.textContent = originalText;
		submitBtn.disabled = false;
	}
});
