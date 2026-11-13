"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  verifyAdminPasscode,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from "@/lib/admin-auth";
import { getClientIp, limit } from "@/lib/ratelimit";

export async function adminLogin(formData: FormData) {
  const reqHeaders = await headers();
  const clientIp = getClientIp(reqHeaders);
  const ipCheck = await limit("admin_login", clientIp);
  if (!ipCheck.ok) {
    redirect(`/admin/login?error=ratelimit&retryAfter=${ipCheck.retryAfter}`);
  }

  if (!process.env.ADMIN_PASSCODE) {
    redirect("/admin/login?error=config");
  }

  const token = String(formData.get("token") ?? "");
  if (!verifyAdminPasscode(token)) {
    redirect("/admin/login?error=1");
  }

  await setAdminSessionCookie();
  redirect("/admin");
}

export async function adminLogout() {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
