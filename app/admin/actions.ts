"use server";

import { redirect } from "next/navigation";
import {
  verifyAdminPasscode,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from "@/lib/admin-auth";

export async function adminLogin(formData: FormData) {
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
