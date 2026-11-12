import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const numericFields = ["kcal_per100", "protein_per100", "carbs_per100", "fat_per100"] as const;
function payload(body: Record<string, unknown>) {
  const values = Object.fromEntries(numericFields.map((key) => [key, Number(body[key] ?? 0)]));
  if (!String(body.name ?? "").trim() || Object.values(values).some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Dữ liệu nguyên liệu không hợp lệ.");
  return { name: String(body.name).trim(), ...values, allergens: Array.isArray(body.allergens) ? body.allergens.map(String).filter(Boolean) : [], usda_fdc_id: body.usda_fdc_id ? String(body.usda_fdc_id) : null, source: body.source === "usda" ? "usda" : "manual" };
}
export async function GET() { if (!await isAdmin()) return NextResponse.json({ error: "Không có quyền." }, { status: 401 }); const { data, error } = await createServerSupabaseClient().from("ingredients").select("*").order("name"); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data); }
export async function POST(request: Request) { if (!await isAdmin()) return NextResponse.json({ error: "Không có quyền." }, { status: 401 }); try { const { data, error } = await createServerSupabaseClient().from("ingredients").insert(payload(await request.json())).select().single(); if (error) throw error; return NextResponse.json(data, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu nguyên liệu." }, { status: 400 }); } }
