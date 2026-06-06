import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import sqlSchemaRaw from '../schema.sql?raw';

describe('GET /health', () => {
	beforeAll(async () => {
		const cleanSql = sqlSchemaRaw
			.split('\n')
			.map((line) => line.split('--')[0].trim())
			.filter((line) => line.length > 0)
			.join(' ');

		await env.DB.exec(cleanSql);
	});

	it('reports healthy only after the D1 schema is available', async () => {
		const response = await SELF.fetch('http://localhost/health');

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			service: 'ok',
			db: 'ok',
		});
	});
});
