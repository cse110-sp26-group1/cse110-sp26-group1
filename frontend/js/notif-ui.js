// notif-ui.js — wires the notification dropdown interactions in tracker.html.
// Pure UI layer: imports data functions from notifications.js, touches no localStorage directly.

import { markAllNotificationsAsRead, renderNotificationBadge, renderNotificationDropdown } from './notifications.js';

const notifBtn = document.getElementById('notif-btn');
const notifDropdown = document.getElementById('notif-dropdown');
const markAllBtn = document.getElementById('notif-mark-all');
const notifSidebarRow = document.getElementById('notif-sidebar-row');
const viewAllBtn = document.getElementById('notif-view-all');

// Tracks the active filter tab so re-renders after mark-all respect the current view
let activeFilter = 'all';

/**
 * Opens the dropdown and renders the current notification list.
 * Also applies the .active outline to the inbox button (see tracker.css .notif-btn.active).
 */
function openDropdown() {
	document.dispatchEvent(new CustomEvent('topbar:open', { detail: 'notif' }));
	notifDropdown.hidden = false;
	notifBtn.classList.add('active');
	renderNotificationDropdown(activeFilter);
}

/** Hides the dropdown and removes the active outline from the inbox button. */
function closeDropdown() {
	notifDropdown.hidden = true;
	notifBtn.classList.remove('active');
}

if (notifBtn && notifDropdown) {
	// Toggle on inbox button click; stopPropagation prevents the document handler below from immediately closing it
	notifBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		if (notifDropdown.hidden) {
			openDropdown();
		} else {
			closeDropdown();
		}
	});

	// Close this dropdown when another topbar module announces it is opening.
	document.addEventListener('topbar:open', (e) => {
		if (e.detail !== 'notif') closeDropdown();
	});

	// Close the dropdown when the user clicks anywhere outside the notif-wrap container
	document.addEventListener('click', (e) => {
		if (!notifDropdown.hidden && !e.target.closest('#notif-wrap')) {
			closeDropdown();
		}
	});
}

// "Mark all read" — updates storage, refreshes badge and list in-place
markAllBtn?.addEventListener('click', () => {
	markAllNotificationsAsRead();
	renderNotificationBadge();
	renderNotificationDropdown(activeFilter);
});

// Filter tab clicks (All / Issues) — delegate from the tabs container
document.getElementById('notif-tabs')?.addEventListener('click', (e) => {
	const tab = e.target.closest('.notif-tab');
	if (!tab) return;
	document.querySelectorAll('.notif-tab').forEach((t) => t.classList.remove('active'));
	tab.classList.add('active');
	activeFilter = tab.dataset.filter;
	renderNotificationDropdown(activeFilter);
});

// Sidebar "Notifications" row (DES-08) opens the same dropdown.
// stopPropagation prevents the document-level outside-click handler from immediately closing it,
// since the sidebar row is outside #notif-wrap.
notifSidebarRow?.addEventListener('click', (e) => {
	e.stopPropagation();
	openDropdown();
});

// "View all notifications" footer link — for now opens the dropdown (no separate page yet)
viewAllBtn?.addEventListener('click', () => {
	openDropdown();
});

// Populate badge on page load so the count is correct before the user opens the dropdown
renderNotificationBadge();
