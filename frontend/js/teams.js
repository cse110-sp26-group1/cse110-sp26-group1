const backdrop = document.getElementById('createBackdrop');
const teamNameEl = document.getElementById('teamName');
const teamSlugEl = document.getElementById('teamSlug');
const toast = document.getElementById('toast');

function openModal() {
	backdrop.classList.add('open');
	teamNameEl.focus();
}
function closeModal() {
	backdrop.classList.remove('open');
}

document.getElementById('createTeam').addEventListener('click', openModal);
document.getElementById('createTeam2').addEventListener('click', (e) => {
	e.preventDefault();
	openModal();
});
document.getElementById('cancelCreate').addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => {
	if (e.target === backdrop) {
		closeModal();
	}
});

// auto-slug from name
teamNameEl.addEventListener('input', (e) => {
	const slug = e.target.value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	teamSlugEl.value = slug;
});

document.getElementById('confirmCreate').addEventListener('click', () => {
	const name = teamNameEl.value.trim();
	if (!name) {
		teamNameEl.focus();
		return;
	}
	const slug = teamSlugEl.value.trim() || 'new-team';
	location.href = `tracker.html?team=${encodeURIComponent(slug)}`;
});

function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

document.querySelectorAll('.invite .actions .primary').forEach((b) => {
	b.addEventListener('click', (e) => {
		e.stopPropagation();
		showToast('Invitation accepted — opening workspace…');
		setTimeout(() => {
			location.href = 'tracker.html?team=invited';
		}, 900);
	});
});
