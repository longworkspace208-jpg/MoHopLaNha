import { CustomerMenu } from "@/components/customer-menu";
import { getCachedTodayMenu, todayInVietnam } from "@/lib/menu-cache";

export const revalidate = 3600;

export default async function MenuPage() {
  const menuDate = todayInVietnam();
  const initialMenu = await getCachedTodayMenu(menuDate);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <CustomerMenu initialMenu={initialMenu} />
    </main>
  );
}
