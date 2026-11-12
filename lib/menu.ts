import type { Dish } from "./types";

export const menu: Dish[] = [
  { id: "ga-nuong-com-gao-lut", name: "Gà nướng cơm gạo lứt", price: 78600, image: "🍗", description: "Ức gà nướng, rau củ áp chảo và gạo lứt dẻo thơm.", nutrition: { kcal: 535, protein: 42, carbs: 59, fat: 14, fiber: 9 } },
  { id: "ca-hoi-sot-chanh", name: "Cá hồi sốt chanh", price: 98600, image: "🐟", description: "Cá hồi áp chảo, khoai lang và salad xanh.", nutrition: { kcal: 610, protein: 38, carbs: 46, fat: 29, fiber: 8 } },
  { id: "dau-hu-nam-hat", name: "Đậu hũ nấm hạt", price: 68600, image: "🥗", description: "Đậu hũ non, nấm đùi gà, hạt điều và cơm gạo lứt.", nutrition: { kcal: 460, protein: 22, carbs: 57, fat: 17, fiber: 12 } }
];

export const findDish = (id: string) => menu.find((dish) => dish.id === id);
