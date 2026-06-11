// Keep this before CSS so the saved theme is applied before first paint.
try {
	if (localStorage.getItem('theme') === 'dark') {
		document.documentElement.classList.add('dark');
	}
} catch {
	/* localStorage unavailable */
}
