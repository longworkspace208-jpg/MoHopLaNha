import "server-only";
import { cookies } from "next/headers";

export async function isAdmin() {
  return Boolean(process.env.ADMIN_PASSCODE) && (await cookies()).get("mhln_admin")?.value === process.env.ADMIN_PASSCODE;
}
