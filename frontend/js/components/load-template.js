/**
 * Fetches an HTML component file and returns a template element by id.
 * @param {string} importMetaUrl import.meta.url from the calling module.
 * @param {string} relativeHtmlPath Path relative to the calling module.
 * @param {string} templateId id of the `<template>` element to extract.
 * @returns {Promise<HTMLTemplateElement>}
 */
export async function loadHtmlTemplate(importMetaUrl, relativeHtmlPath, templateId) {
	const url = new URL(relativeHtmlPath, importMetaUrl);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load template (${response.status})`);
	}

	const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
	const template = doc.getElementById(templateId);
	if (!template) {
		throw new Error(`${templateId} not found`);
	}

	return template;
}
