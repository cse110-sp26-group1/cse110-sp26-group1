import { fetchTeams, fetchIssues, createTeam, acceptInvite } from './mock-api.js';

const backdrop = document.getElementById('createBackdrop');
const teamNameEl = document.getElementById('teamName');
const toast = document.getElementById('toast');

const gridEl = document.querySelector('.grid');
const confirmCreateBtn = document.getElementById('confirmCreate');

/**
 * Opens the create-team modal and focuses the team-name input.
 */
function openModal() {
	backdrop.classList.add('open');
	teamNameEl.focus();
}
/**
 * Closes the create-team modal.
 */
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

// createTeam
document.getElementById('confirmCreate').addEventListener('click', async () => {
    const nameEl = document.getElementById('teamName');
    const slugEl = document.getElementById('teamSlug');
    
    const name = nameEl.value.trim();
    const slug = slugEl.value.trim();

    if (!name) {
        nameEl.focus();
        return;
    }

    const confirmBtn = document.getElementById('confirmCreate');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Creating...';
    confirmBtn.disabled = true;

    try {
        const words = name.split(' ');
        let mark = words[0].substring(0, 2).toUpperCase();
        if (words.length > 1) {
            mark = (words[0][0] + words[1][0]).toUpperCase();
        }

        const newTeam = await createTeam({
            name: name,
            slug: slug,
            mark: mark
        });

        showToast(`Workspace created! Redirecting...`);

        closeModal();

        setTimeout(() => {
            location.href = `tracker.html?team=${encodeURIComponent(newTeam.slug)}`;
        }, 800);

    } catch (err) {
        console.error(err);
        showToast(err.message || "Failed to create team.");
    } finally {
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;
    }
});

/**
 * Shows a temporary status message.
 *
 * @param {string} msg Message to display.
 */
function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

document.querySelectorAll('.accept-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
        const teamSlug = e.target.dataset.slug;
        const originalText = e.target.textContent;
        
        e.target.textContent = 'Accepting...';
        e.target.disabled = true;

        try {
            await acceptInvite(teamSlug);
            showToast('Invitation accepted!');
            
            // Remove the invite from the screen
            e.target.closest('.invite').remove();
            
            // Re-render the grid to show the newly unlocked team
            initTeamsPage(); 
            
        } catch (err) {
            console.error(err);
            showToast("Failed to accept invite.");
            e.target.textContent = originalText;
            e.target.disabled = false;
        }
    });
});

document.querySelectorAll('.decline-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.invite').remove();
        showToast('Invitation declined.');
    });
});

document.getElementById('confirmCreate').addEventListener('click', async () => {
    const nameEl = document.getElementById('teamName');
    const bioEl = document.getElementById('teamBio');
    
    const name = nameEl.value.trim();
    const bio = bioEl.value.trim();

    if (!name) {
        nameEl.focus();
        return;
    }

    const confirmBtn = document.getElementById('confirmCreate');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Creating...';
    confirmBtn.disabled = true;

    try {
        const words = name.split(' ');
        let mark = words[0].substring(0, 2).toUpperCase();
        if (words.length > 1) {
            mark = (words[0][0] + words[1][0]).toUpperCase();
        }

        const newTeam = await createTeam({
            name: name,
            bio: bio, 
            mark: mark
        });

        showToast(`Workspace created! Redirecting...`);
        closeModal();

        setTimeout(() => {
            location.href = `tracker.html?team=${encodeURIComponent(newTeam.slug)}`;
        }, 800);

    } catch (err) {
        console.error(err);
        showToast(err.message || "Failed to create team.");
    } finally {
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;
    }
});

/**
 *
 */
async function initTeamsPage() {
    try {
        const [teams, issues] = await Promise.all([
            fetchTeams(),
            fetchIssues() 
        ]);
        
        const grid = document.getElementById('teamGrid');

        const createBtnHtml = grid.querySelector('.team.new').outerHTML;

        const teamsHtml = teams.map(team => {
            const teamIssues = issues.filter(i => i.team_id === team.id);
            const openCount = teamIssues.filter(i => i.status === 'open').length;
            const progCount = teamIssues.filter(i => i.status === 'in-progress').length;
            const doneCount = teamIssues.filter(i => i.status === 'done' || i.status === 'closed').length;

            return `
                <a class="team" href="tracker.html?team=${team.slug}">
                    <div class="team-head">
                        <div class="team-mark" style="background: oklch(0.92 0.04 ${team.color}); color: oklch(0.4 0.12 ${team.color})">${team.mark}</div>
                        <div>
                            <h2>${team.name}</h2>
                            <div class="slug">${team.slug}</div>
                        </div>
                    </div>
                    <div class="stats">
                        <div class="stat"><span class="n">${openCount}</span><span class="l">open</span></div>
                        <div class="stat"><span class="n">${progCount}</span><span class="l">in prog</span></div>
                        <div class="stat"><span class="n">${doneCount}</span><span class="l">done</span></div>
                    </div>
                    <div class="team-foot">
                        <div class="members"><span class="avatar">AL</span></div>
                        <span class="last-active">active recently</span>
                    </div>
                </a>
            `;
        }).join('');

        grid.innerHTML = teamsHtml + createBtnHtml;

        document.getElementById('createTeam2').addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });

    } catch (err) {
        console.error("Failed to load teams:", err);
        showToast("Failed to load dashboard.");
    }
}

initTeamsPage();