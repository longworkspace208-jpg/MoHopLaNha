import {
  getFallbackDishes,
  getFallbackTodayOrderedCounts,
} from "@/lib/orders-db";
import { calcPortion } from "@/lib/nutrition";
import demoSeed from "@/lib/demo-seed.json";
import { HeroSection, type HeroDishItem } from "@/components/hero-section";
import { PreferencePicker } from "@/components/preference-picker";
import {
  HomeGoalShowcase,
  HomeTraceabilityAndFaq,
  type RetentionDishItem,
} from "@/components/home-retention-section";

export const dynamic = "force-static";

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
    title: "Cá hồi áp chảo sốt chanh",
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

const GOAL_RECOMMENDATIONS: Record<
  string,
  Array<"balanced" | "light" | "protein">
> = {
  "ca-hoi-sot-chanh": ["balanced", "protein"],
  "ga-nuong-com-gao-lut": ["balanced", "protein"],
  "dau-hu-nam-hat": ["balanced", "light"],
  "thit-kho-trung-gao-lut": ["balanced", "protein"],
};

export default function Home() {
  const dishes = getFallbackDishes();
  const orderedCounts = getFallbackTodayOrderedCounts();
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const ingredientsMap = new Map(
    demoSeed.ingredients.map((ing) => [ing.id, ing])
  );

  const heroDishes: HeroDishItem[] = HERO_ORDER.map(
    (id): HeroDishItem | null => {
      const dish = byId.get(id);
      const meta = HERO_DISH_META[id];
      if (!dish || !meta) return null;

      const portion = calcPortion(dish.nutrition_per100, dish.yield_g);
      const remaining = Math.max(
        0,
        dish.portion_limit - (orderedCounts.get(dish.id) ?? 0)
      );

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
    }
  ).filter((x): x is HeroDishItem => x !== null);

  const retentionDishes: RetentionDishItem[] = HERO_ORDER.map(
    (id): RetentionDishItem | null => {
      const dish = byId.get(id);
      const meta = HERO_DISH_META[id];
      if (!dish || !meta) return null;

      const portion = calcPortion(dish.nutrition_per100, dish.yield_g);
      const remaining = Math.max(
        0,
        dish.portion_limit - (orderedCounts.get(dish.id) ?? 0)
      );
      const dishIngredients = dish.recipe
        .map((r) => ingredientsMap.get(r.ingredientId))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      const allergens = Array.from(
        new Set(dishIngredients.flatMap((ing) => ing.allergens))
      );

      return {
        id: dish.id,
        name: meta.title,
        imageSrc: meta.imageSrc,
        priceVnd: dish.price_vnd,
        grams: dish.yield_g,
        kcal: Math.round(portion.kcal),
        proteinG: Number(portion.protein.toFixed(1)),
        carbsG: Number(portion.carbs.toFixed(1)),
        fatG: Number(portion.fat.toFixed(1)),
        allergens,
        ingredientsSummary: dishIngredients.map((i) => i.name).join(", "),
        recommendedFor: GOAL_RECOMMENDATIONS[dish.id] ?? ["balanced"],
        menuDish: {
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
    }
  ).filter((x): x is RetentionDishItem => x !== null);

  return (
    <main className="min-h-screen">
      {/* 1. Hero Section Editorial Split */}
      <HeroSection dishes={heroDishes} />

      {/* 2. Tuyên ngôn bếp ăn & 4 cam kết phân tách bằng đường kẻ */}
      <section
        aria-label="Triết lý bếp Mở Hộp Là Nhà"
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">
              Triết lý bếp nấu
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.15] tracking-tight text-forest sm:text-4xl">
              Chúng tôi không nấu theo cảm tính —{" "}
              <span className="font-normal italic text-coral">
                từng gram đều có lý do.
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink/80">
              Mỗi khẩu phần được thiết kế để giữ trọn sự ngon miệng của cơm nhà truyền thống nhưng kiểm soát chuẩn mực calories và đạm sạch.
            </p>
          </div>

          <div className="grid gap-px border-y border-rule bg-rule sm:grid-cols-2 lg:col-span-7">
            {[
              {
                num: "01",
                title: "Cân thực tế lúc đóng gói",
                desc: "Đối chiếu đúng định lượng gram bạn chọn khi đóng hộp, khóa số liệu snapshot vĩnh viễn.",
              },
              {
                num: "02",
                title: "Tem QR trên từng hộp cơm",
                desc: "Quét nắp hộp để xem mã lô chế biến, nguyên liệu và cảnh báo dị ứng minh bạch.",
              },
              {
                num: "03",
                title: "Chuyển khoản đối soát minh bạch",
                desc: "Chuyển khoản đúng mã đơn MHLN#### và theo dõi tiến độ nấu tới lúc giao nóng.",
              },
              {
                num: "04",
                title: "Nấu mới theo mẻ giới hạn",
                desc: "Mỗi ngày chia suất theo mẻ nấu để giữ độ tươi, không bảo quản lưu cữu qua ngày.",
              },
            ].map((pillar) => (
              <div key={pillar.num} className="bg-white p-6 sm:p-7">
                <span className="font-mono text-sm font-bold tracking-[0.16em] text-coral">
                  {pillar.num}
                </span>
                <h3 className="mt-2.5 font-display text-lg font-bold text-forest">
                  {pillar.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Khám phá thực đơn theo mục tiêu */}
      <HomeGoalShowcase dishes={retentionDishes} />

      {/* 4. Mảng Deep Forest Green cho khu vực cá nhân hóa bàn ăn */}
      <section
        id="chon-khau-phan"
        className="bg-forest py-16 text-white sm:py-20"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:items-start lg:px-10">
          <div className="space-y-6 lg:col-span-5">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">
                Cá nhân hóa khẩu phần
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold leading-[1.12] tracking-tight text-white sm:text-4xl">
                Cơm nhà lành mạnh,{" "}
                <span className="font-normal italic text-coral">
                  vừa ý cả bàn ăn.
                </span>
              </h2>
            </div>

            <p className="text-base leading-relaxed text-ivory/85">
              Chọn nhanh số người ăn và mục tiêu dinh dưỡng để nhận ngay 3 combo cân chỉnh sẵn gram, hoặc tự do điều chỉnh từng món lẻ.
            </p>

            <ul className="divide-y divide-white/15 border-y border-white/15 text-sm text-ivory/90">
              <li className="flex items-center justify-between py-3.5">
                <span>Định lượng cân thực tế khi đóng gói</span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-coral">
                  Bước gram
                </span>
              </li>
              <li className="flex items-center justify-between py-3.5">
                <span>Tem QR Nutrition Snapshot trên từng hộp</span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-coral">
                  Minh bạch
                </span>
              </li>
              <li className="flex items-center justify-between py-3.5">
                <span>Chốt đơn chuyển khoản &amp; theo dõi trực tiếp</span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-coral">
                  MHLN####
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-sm border-2 border-white/20 bg-forest-dark/80 p-6 sm:p-8 lg:col-span-7">
            <PreferencePicker />
          </div>
        </div>
      </section>

      {/* 5–7. Quy trình QR, Specimen Sheet, FAQ & Closing Band */}
      <HomeTraceabilityAndFaq primaryDish={retentionDishes[0]} />
    </main>
  );
}
