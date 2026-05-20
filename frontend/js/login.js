const authForm = document.getElementById('authForm');

/**
 * Handles sign-in form submit. Validates email and password, then
 * redirects to the teams page. No API call until backend auth is wired.
 *
 * @param {SubmitEvent} e Form submit event.
 */
function handleLoginSubmit(e) {
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

	location.href = 'teams.html';
}

authForm.addEventListener('submit', handleLoginSubmit);
