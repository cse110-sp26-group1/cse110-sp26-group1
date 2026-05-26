// Persists the user's light/dark choice and wires up #theme-toggle on whatever
// page imports it. The <head> FOUC script in each HTML applies the saved class
// before paint; this module just keeps state in sync after load.

const root = document.documentElement;
const KEY = 'theme';

try {
	if (localStorage.getItem(KEY) === 'dark') {
		root.classList.add('dark');
	}
} catch {
	// localStorage unavailable (private mode, sandboxed iframe, etc.) — no-op
}

const btn = document.getElementById('theme-toggle');
if (btn) {
	btn.addEventListener('click', () => {
		const next = root.classList.contains('dark') ? 'light' : 'dark';
		root.classList.toggle('dark', next === 'dark');
		try {
			localStorage.setItem(KEY, next);
		} catch {
			// localStorage unavailable
		}
	});
}
