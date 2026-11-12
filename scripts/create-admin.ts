/**
 * Bootstrap the FIRST administrator (refuses if any administrator already exists).
 *   ADMIN_EMAIL=a@b.org ADMIN_NAME="الاسم" ADMIN_PASSWORD='...' npm run admin:create
 * Later administrators are created from the dashboard by an authenticated administrator.
 */
import "dotenv/config";
import { bootstrapFirstAdmin } from "../src/lib/auth/service";

const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD in the environment.");
  process.exit(1);
}
bootstrapFirstAdmin(ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD)
  .then((a) => console.log(`Administrator created: ${a.email}`))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => process.exit());
