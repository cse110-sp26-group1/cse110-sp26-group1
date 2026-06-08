let dest = 'login.html?redirect=' + encodeURIComponent(new URL('teams.html', location.href).href);
try {
	if (localStorage.getItem('allegro_token')) {
		dest = 'teams.html';
	}
} catch {
	/* localStorage unavailable */
}
location.replace(dest);
