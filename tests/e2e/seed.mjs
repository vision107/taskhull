import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl });
const password = await hashPassword("E2e-password-123!");

async function seedUser({
	email,
	name,
	role,
	organization,
	organizationRole = "owner",
}) {
	const result = await pool.query(
		`INSERT INTO "user" (name, email, email_verified, role, onboarding_complete)
		 VALUES ($1, $2, true, $3, true)
		 ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
		 email_verified = true, onboarding_complete = true, two_factor_enabled = false
		 RETURNING id`,
		[name, email, role],
	);
	const userId = result.rows[0].id;
	await pool.query(`DELETE FROM two_factor WHERE user_id = $1`, [userId]);
	await pool.query(`DELETE FROM passkey WHERE user_id = $1`, [userId]);
	await pool.query(
		`INSERT INTO account (account_id, provider_id, user_id, password)
		 VALUES ($1, 'credential', $2, $3)
		 ON CONFLICT (provider_id, account_id) DO UPDATE SET password = EXCLUDED.password`,
		[userId, userId, password],
	);
	if (organization) {
		const org = await pool.query(
			`INSERT INTO organization (name, slug) VALUES ($1, $2)
			 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
			[organization.name, organization.slug],
		);
		await pool.query(
			`INSERT INTO member (organization_id, user_id, role) VALUES ($1, $2, $3)
			 ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role`,
			[org.rows[0].id, userId, organizationRole],
		);
	}
}

await seedUser({
	email: "owner@e2e.local",
	name: "E2E Owner",
	role: "user",
	organization: { name: "E2E Organization", slug: "e2e-organization" },
});
await seedUser({
	email: "organization-admin@e2e.local",
	name: "E2E Organization Admin",
	role: "user",
	organization: { name: "E2E Organization", slug: "e2e-organization" },
	organizationRole: "admin",
});
await seedUser({
	email: "member@e2e.local",
	name: "E2E Member",
	role: "user",
	organization: { name: "E2E Organization", slug: "e2e-organization" },
	organizationRole: "member",
});
await seedUser({
	email: "admin@e2e.local",
	name: "E2E Admin",
	role: "admin",
	organization: { name: "E2E Organization", slug: "e2e-organization" },
	organizationRole: "admin",
});
await pool.end();
