"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export async function adminLogin(formData: FormData) {
  if (!process.env.ADMIN_PASSCODE) redirect("/admin/login?error=config");
  if (formData.get("token") !== process.env.ADMIN_PASSCODE) redirect("/admin/login?error=1");
  (await cookies()).set("mhln_admin", process.env.ADMIN_PASSCODE, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect("/admin");
}
