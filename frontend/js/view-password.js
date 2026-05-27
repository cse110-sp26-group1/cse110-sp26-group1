/**
 * initializes visibility toggle buttons for password inputs
 */
export function initPasswordToggles() {
	document.querySelectorAll('.password-wrapper').forEach((wrapper) => {
		const input = wrapper.querySelector('.password-input');
		const toggle = wrapper.querySelector('.password-toggle');
		if (!input || !toggle) return;

		/**
		 * Synchronizes the password input and toggle state.
		 *
		 * @param {boolean} shouldShow whether the password should be visible.
		 */
		const render = (shouldShow) => {
			input.type = shouldShow ? 'text' : 'password';
			toggle.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
			toggle.setAttribute('aria-pressed', String(shouldShow));
		};

		render(input.type === 'text');

		// css swaps between the show and hide password icons
		toggle.addEventListener('click', () => {
			render(input.type === 'password');
		});
	});
}
