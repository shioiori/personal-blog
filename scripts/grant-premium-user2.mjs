import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set. Run with: node --env-file=.env.local scripts/grant-premium-user2.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  UPDATE users SET premium_expire = (date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '1 day' - interval '1 second') AT TIME ZONE 'Asia/Ho_Chi_Minh'
  WHERE id = 2
  RETURNING id, email, premium_expire
`;

if (!rows[0]) {
  console.error("No user with id = 2 found.");
  process.exit(1);
}

console.log(`User ${rows[0].email} (id ${rows[0].id}) -> premium_expire set to ${rows[0].premium_expire}`);
