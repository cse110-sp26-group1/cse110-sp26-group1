// notifications.js — client-side notification store backed by localStorage.
// All persistence is local-only; there is no /api/notifications endpoint yet.
// Notification shape: { id, type, issueId, title, message, isRead, createdAt }

/**
 * Derives a user-scoped localStorage key so notifications from one signed-in
 * user are never visible to another user on the same browser.
 * Falls back to 'allegro_notifications_anon' when no user is stored, which
 * is always empty for authenticated pages (requireAuth redirects before this runs).
 * @returns {string}
 */
function notifStorageKey() {
	try {
		const raw = localStorage.getItem('allegro_user');
		if (!raw) return 'allegro_notifications_anon';
		const user = JSON.parse(raw);
		const id = user && typeof user === 'object' ? user.username || user.email : null;
		return id ? `allegro_notifications_${id}` : 'allegro_notifications_anon';
	} catch {
		return 'allegro_notifications_anon';
	}
}

/**
 * Returns the full notification list from localStorage, or [] on parse failure.
 * @returns {object[]}
 */
export function getNotifications() {
	try {
		return JSON.parse(localStorage.getItem(notifStorageKey()) || '[]');
	} catch {
		return [];
	}
}

/**
 * Overwrites the stored notification list.
 * @param {object[]} notifications Notification list to store.
 */
export function saveNotifications(notifications) {
	localStorage.setItem(notifStorageKey(), JSON.stringify(notifications));
}

/**
 * Prepends a new-issue notification for the given issue.
 * No-ops if a notification for the same issue already exists (prevents duplicates on re-render).
 * @param {{ id: number, title: string }} issue Issue to summarize in the notification.
 */
export function createIssueNotification(issue) {
	const notifications = getNotifications();
	if (notifications.some((n) => n.type === 'new_issue' && n.issueId === issue.id)) return;

	const n = {
		id: `issue-${issue.id}-${Date.now()}`,
		type: 'new_issue',
		issueId: issue.id,
		title: 'New issue',
		message: issue.title,
		isRead: false,
		createdAt: new Date().toISOString(),
	};

	notifications.unshift(n);
	saveNotifications(notifications);
}

/**
 * Marks a single notification as read by its id.
 * @param {string} id Notification id to mark as read.
 */
export function markNotificationAsRead(id) {
	const notifications = getNotifications();
	const n = notifications.find((x) => x.id === id);
	if (n) n.isRead = true;
	saveNotifications(notifications);
}

/** Marks every stored notification as read. */
export function markAllNotificationsAsRead() {
	const notifications = getNotifications().map((n) => ({ ...n, isRead: true }));
	saveNotifications(notifications);
}

/**
 * Converts an ISO timestamp to a short human-readable age string (e.g. "5m ago").
 * @param {string} iso ISO timestamp to format.
 * @returns {string}
 */
function relativeTime(iso) {
	const diff = Date.now() - new Date(iso).getTime();
	const m = Math.floor(diff / 60000);
	if (m < 1) return 'just now';
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	return `${d}d ago`;
}

/**
 * Updates the unread-count badge on both the topbar inbox button and the sidebar row.
 * Hides the badge entirely when the count is zero.
 */
export function renderNotificationBadge() {
	const badge = document.getElementById('notif-badge');
	const sidebarBadge = document.getElementById('notif-sidebar-count');
	const unread = getNotifications().filter((n) => !n.isRead).length;

	if (badge) {
		badge.textContent = unread > 9 ? '9+' : String(unread);
		badge.hidden = unread === 0;
	}
	if (sidebarBadge) {
		sidebarBadge.textContent = unread > 9 ? '9+' : String(unread);
		sidebarBadge.hidden = unread === 0;
	}
}

/**
 * Rebuilds the notification dropdown list for the given filter tab.
 * Clicking a row marks it as read in-place without a full re-render.
 * @param {'all'|'issues'} [filter='all'] Notification filter to display.
 */
export function renderNotificationDropdown(filter = 'all') {
	const list = document.getElementById('notif-list');
	if (!list) return;

	let notifications = getNotifications();
	if (filter === 'issues') notifications = notifications.filter((n) => n.type === 'new_issue');

	if (notifications.length === 0) {
		list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
		return;
	}

	list.innerHTML = notifications
		.map((n) => {
			const dot = n.isRead ? `<span class="notif-dot read"></span>` : `<span class="notif-dot unread"></span>`;
			const age = relativeTime(n.createdAt);
			// new_issue items show bold title + monospace issue number
			const text =
				n.type === 'new_issue' ? `<strong>${n.title}</strong> · <span class="notif-mono">#${n.issueId}</span> ${n.message}` : n.message;

			return `<div class="notif-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
				${dot}
				<div class="notif-body">
					<div class="notif-text">${text}</div>
					<div class="notif-age">${age}</div>
				</div>
			</div>`;
		})
		.join('');

	// Mark individual items as read on click without re-rendering the whole list
	list.querySelectorAll('.notif-item').forEach((el) => {
		el.addEventListener('click', () => {
			markNotificationAsRead(el.dataset.id);
			el.classList.remove('unread');
			el.querySelector('.notif-dot')?.classList.replace('unread', 'read');
			renderNotificationBadge();
		});
	});
}

/** Alias kept for external callers that may use the longer name. */
export function renderNotificationList() {
	renderNotificationDropdown();
}
