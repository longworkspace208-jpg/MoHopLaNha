import type { Dish } from "./types";

export const menu: Dish[] = [
  {
    id: "ga-nuong-com-gao-lut",
    name: "Gà nướng cơm gạo lứt",
    price: 78000,
    image: "/images/dishes/ga-nuong-com-gao-lut.jpg",
    description: "Ức gà nướng thảo mộc mềm mọng cùng cơm gạo lứt dẻo thơm và rau củ áp chảo.",
    nutrition: { kcal: 535, protein: 42, carbs: 59, fat: 14, fiber: 9 }
  },
  {
    id: "ca-hoi-sot-chanh",
    name: "Cá hồi áp chảo sốt chanh",
    price: 98000,
    image: "/images/dishes/ca-hoi-ap-chao.jpg",
    description: "Cá hồi Na Uy áp chảo sốt chanh bơ thảo mộc ăn kèm khoai lang nghiền mịn và rau củ.",
    nutrition: { kcal: 610, protein: 38, carbs: 46, fat: 29, fiber: 8 }
  },
  {
    id: "dau-hu-nam-hat",
    name: "Đậu hũ non xào nấm hạt",
    price: 68000,
    image: "/images/dishes/dau-hu-nam-hat.jpg",
    description: "Đậu hũ non áp chảo hòa quyện nấm đùi gà, rau củ thanh mát và cơm gạo lứt.",
    nutrition: { kcal: 460, protein: 22, carbs: 57, fat: 17, fiber: 12 }
  },
  {
    id: "thit-kho-trung-gao-lut",
    name: "Thịt heo kho củ sen",
    price: 75000,
    image: "/images/dishes/thit-kho-cu-sen.jpg",
    description: "Thịt heo nạc kho dịu vừa vị cùng củ sen giòn bùi, rau củ áp chảo và cơm gạo lứt ấm nóng.",
    nutrition: { kcal: 520, protein: 40, carbs: 48, fat: 18, fiber: 7 }
  }
];

export const findDish = (id: string) =>
  menu.find((dish) => dish.id === id || dish.name === id);
