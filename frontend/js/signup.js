const authForm = document.getElementById('authForm');

/**
 * Handles create-account form submit. Validates name, email, and password,
 * then redirects to the teams page. No API call until backend auth is wired.
 *
 * @param {SubmitEvent} e Form submit event.
 */
function handleSignupSubmit(e) {
	e.preventDefault();
	const firstEl = document.getElementById('first');
	const lastEl = document.getElementById('last');
	const emailEl = document.getElementById('email');
	const passwordEl = document.getElementById('password');

	const first = firstEl.value.trim();
	const last = lastEl.value.trim();
	const email = emailEl.value.trim();
	const password = passwordEl.value;

	if (!first || !last || !email || !password) {
		if (!first) firstEl.focus();
		else if (!last) lastEl.focus();
		else if (!email) emailEl.focus();
		else passwordEl.focus();
		return;
	}

	location.href = 'teams.html';
}

authForm.addEventListener('submit', handleSignupSubmit);
