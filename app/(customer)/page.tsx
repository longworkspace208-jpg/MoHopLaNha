import {
  getFallbackDishes,
  getFallbackTodayOrderedCounts,
} from "@/lib/orders-db";
import { calcPortion } from "@/lib/nutrition";
import { HeroSection, type HeroDishItem } from "@/components/hero-section";
import { PreferencePicker } from "@/components/preference-picker";

export const dynamic = "force-dynamic";

const HERO_DISH_META: Record<
  string,
  {
    shortName: string;
    title: string;
    categoryLabel: string;
    tagline: string;
    description: string;
    imageSrc: string;
  }
> = {
  "ca-hoi-sot-chanh": {
    shortName: "Cá hồi áp chảo",
    title: "Cá hồi áp chảo",
    categoryLabel: "Cá Hồi",
    tagline: "Món trứ danh",
    description:
      "Cá hồi Na Uy áp chảo giòn da, phủ sốt chanh bơ thảo mộc ăn kèm khoai nghiền mịn, măng tây và cà chua bi nướng. Cân chuẩn định lượng từng gram và minh bạch dinh dưỡng.",
    imageSrc: "/images/dishes/ca-hoi-ap-chao.jpg",
  },
  "ga-nuong-com-gao-lut": {
    shortName: "Gà nướng gạo lứt",
    title: "Gà nướng cơm gạo lứt",
    categoryLabel: "Gà Nướng",
    tagline: "Giàu Protein",
    description:
      "Ức gà nướng thảo mộc mềm mọng cùng cơm gạo lứt dẻo thơm và rau củ áp chảo, no lâu nhẹ bụng cho cả ngày làm việc.",
    imageSrc: "/images/dishes/ga-nuong-com-gao-lut.jpg",
  },
  "dau-hu-nam-hat": {
    shortName: "Đậu hũ nấm hạt",
    title: "Đậu hũ non xào nấm hạt",
    categoryLabel: "Thanh Đạm",
    tagline: "Ít calories",
    description:
      "Đậu hũ non áp chảo vàng giòn hòa quyện nấm đùi gà, cải xanh và gạo lứt bùi béo tự nhiên.",
    imageSrc: "/images/dishes/dau-hu-nam-hat.jpg",
  },
  "thit-kho-trung-gao-lut": {
    shortName: "Thịt kho củ sen",
    title: "Thịt heo kho củ sen",
    categoryLabel: "Cơm Nhà",
    tagline: "Đậm vị nhà",
    description:
      "Thịt heo nạc kho dịu vừa vị cùng củ sen giòn bùi, cải thìa luộc và cơm gạo lứt ấm nóng chuẩn vị gia đình.",
    imageSrc: "/images/dishes/thit-kho-cu-sen.jpg",
  },
};

const HERO_ORDER = [
  "ca-hoi-sot-chanh",
  "ga-nuong-com-gao-lut",
  "dau-hu-nam-hat",
  "thit-kho-trung-gao-lut",
];

export default function Home() {
  const dishes = getFallbackDishes();
  const orderedCounts = getFallbackTodayOrderedCounts();
  const byId = new Map(dishes.map((d) => [d.id, d]));

  const heroDishes: HeroDishItem[] = HERO_ORDER.map((id): HeroDishItem | null => {
    const dish = byId.get(id);
    const meta = HERO_DISH_META[id];
    if (!dish || !meta) return null;

    const portion = calcPortion(dish.nutrition_per100, dish.yield_g);
    const remaining = Math.max(0, dish.portion_limit - (orderedCounts.get(dish.id) ?? 0));

    return {
      id: dish.id,
      shortName: meta.shortName,
      title: meta.title,
      categoryLabel: meta.categoryLabel,
      tagline: meta.tagline,
      description: meta.description,
      imageSrc: meta.imageSrc,
      priceVnd: dish.price_vnd,
      grams: dish.yield_g,
      kcal: Math.round(portion.kcal),
      proteinG: Number(portion.protein.toFixed(1)),
      fallbackMenuDish: {
        id: dish.id,
        name: dish.name,
        price_vnd: dish.price_vnd,
        image_url: meta.imageSrc,
        yield_g: dish.yield_g,
        portion_limit: dish.portion_limit,
        remaining_portions: remaining,
        step_g: dish.step_g,
        min_g: dish.min_g,
        max_g: dish.max_g,
        nutrition_per100: dish.nutrition_per100,
      },
    };
  }).filter((x): x is HeroDishItem => x !== null);

  return (
    <main className="min-h-screen pb-16">
      <HeroSection dishes={heroDishes} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section
          id="chon-khau-phan"
          className="mt-10 grid gap-6 rounded-[1.75rem] bg-brand-950/5 p-5 sm:p-8 lg:grid-cols-12 lg:items-start"
        >
        <div className="space-y-4 lg:col-span-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-600">
            Cá nhân hóa theo bàn ăn
          </p>
          <h2 className="text-2xl font-black leading-tight text-brand-950 sm:text-3xl">
            Cơm nhà lành mạnh, vừa ý cả bàn ăn.
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Chọn nhanh số người ăn và mục tiêu dinh dưỡng để nhận gợi ý 3 combo cân chỉnh sẵn gram, hoặc tự ghép từng món theo khẩu vị.
          </p>
          <ul className="space-y-2 text-xs font-semibold text-brand-950">
            <li className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-700 text-[10px] text-white">
                ✓
              </span>
              Định lượng cân thực tế khi đóng gói
            </li>
            <li className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-700 text-[10px] text-white">
                ✓
              </span>
              Tem QR Nutrition Snapshot trên từng hộp cơm
            </li>
            <li className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-700 text-[10px] text-white">
                ✓
              </span>
              Chốt đơn VietQR minh bạch, giao nóng đúng hẹn
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <PreferencePicker />
        </div>
        </section>
      </div>
    </main>
  );
}
