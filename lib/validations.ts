import { z } from "zod";

// Biểu thức chính quy cho số điện thoại di động Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc 02)
export const VN_PHONE_REGEX = /^(03|05|07|08|09|02)\d{8}$/;

/**
 * Schema xác thực dữ liệu đặt đơn hàng khách hàng (POST /api/orders)
 */
export const orderCreationSchema = z.object({
  customerName: z
    .string({ message: "Vui lòng nhập họ và tên người nhận." })
    .trim()
    .min(2, { message: "Họ và tên người nhận tối thiểu 2 ký tự." })
    .max(100, { message: "Họ và tên người nhận tối đa 100 ký tự." }),
  phone: z
    .string({ message: "Vui lòng nhập số điện thoại người nhận." })
    .trim()
    .regex(VN_PHONE_REGEX, { message: "Số điện thoại không đúng định dạng Việt Nam (10 chữ số, ví dụ: 0912345678)." })
    .max(15, { message: "Số điện thoại không hợp lệ." }),
  address: z
    .string({ message: "Vui lòng nhập địa chỉ nhận hàng." })
    .trim()
    .min(5, { message: "Địa chỉ nhận hàng tối thiểu 5 ký tự." })
    .max(255, { message: "Địa chỉ nhận hàng tối đa 255 ký tự." }),
  deliveryAddress: z.string().trim().max(255).optional(),
  email: z
    .string()
    .trim()
    .email({ message: "Địa chỉ email không đúng định dạng." })
    .max(100, { message: "Email tối đa 100 ký tự." })
    .optional()
    .or(z.literal("")),
  customerEmail: z.string().trim().max(100).optional().or(z.literal("")),
  note: z
    .string()
    .trim()
    .max(300, { message: "Ghi chú tối đa 300 ký tự." })
    .optional()
    .or(z.literal("")),
  source: z.string().trim().max(50).optional(),
  overrideArea: z.boolean().optional(),
  people: z
    .number()
    .int({ message: "Số người ăn phải là số nguyên." })
    .min(1, { message: "Số người ăn tối thiểu là 1." })
    .max(10, { message: "Số người ăn tối đa là 10." })
    .optional(),
  items: z
    .array(
      z.object({
        dishId: z.string().trim().min(1, { message: "Mã món ăn không được để trống." }).max(100),
        grams: z
          .number({ message: "Vui lòng nhập định lượng gram." })
          .int({ message: "Định lượng gram phải là số nguyên." })
          .positive({ message: "Định lượng gram phải là số dương lớn hơn 0." })
          .max(10000, { message: "Định lượng tối đa cho 1 món là 10,000g." }),
      })
    )
    .min(1, { message: "Vui lòng chọn ít nhất 1 món ăn vào khay cơm." })
    .max(20, { message: "Mỗi đơn hàng tối đa 20 món ăn." }),
  lines: z
    .array(
      z.object({
        dishId: z.string().trim().min(1).max(100).optional(),
        dish: z.object({ id: z.string() }).optional(),
        grams: z.number().optional(),
        gramsPerPerson: z.number().optional(),
        quantity: z.number().optional(),
      })
    )
    .max(20)
    .optional(),
});

/**
 * Kiểm tra ràng buộc bước nhảy và khoảng gram của món ăn
 */
export function validateGramsForDish(
  dish: { name: string; min_g: number; max_g: number; step_g: number },
  grams: number
): { valid: boolean; error?: string } {
  if (grams < dish.min_g) {
    return {
      valid: false,
      error: `Định lượng món "${dish.name}" tối thiểu là ${dish.min_g}g.`,
    };
  }
  if (grams > dish.max_g) {
    return {
      valid: false,
      error: `Định lượng món "${dish.name}" tối đa là ${dish.max_g}g.`,
    };
  }
  if (dish.step_g > 0 && grams % dish.step_g !== 0 && (grams - dish.min_g) % dish.step_g !== 0) {
    return {
      valid: false,
      error: `Định lượng món "${dish.name}" (${grams}g) phải là bội số của bước nhảy ${dish.step_g}g.`,
    };
  }
  return { valid: true };
}

/**
 * Schema tìm kiếm USDA FoodData Central
 */
export const usdaSearchQuerySchema = z.object({
  q: z
    .string({ message: "Vui lòng cung cấp từ khóa tìm kiếm nguyên liệu." })
    .trim()
    .min(1, { message: "Từ khóa tìm kiếm không được để trống." })
    .max(100, { message: "Từ khóa tìm kiếm tối đa 100 ký tự." }),
});

/**
 * Schema tạo mẻ nấu (Admin Cooking Batch)
 */
export const cookingBatchCreateSchema = z.object({
  dishId: z.string().trim().min(1, { message: "Mã món không được để trống." }).max(100),
  dishName: z.string().trim().min(1, { message: "Tên món không được để trống." }).max(200),
  lotCode: z.string().trim().min(1, { message: "Mã lô (Lot Code) không được để trống." }).max(100),
  supplierNote: z.string().trim().max(500, { message: "Ghi chú nhà cung cấp tối đa 500 ký tự." }).optional().nullable(),
  cookedYieldG: z
    .number({ message: "Vui lòng nhập định lượng mẻ nấu (g)." })
    .positive({ message: "Định lượng mẻ nấu phải lớn hơn 0." })
    .max(100000, { message: "Định lượng mẻ nấu tối đa 100,000g." }),
  cookedAt: z.string().trim().min(1, { message: "Thời điểm nấu không được để trống." }).max(100),
});

/**
 * Schema cân và đóng gói món (Admin Pack)
 */
export const packOrderSchema = z.object({
  orderItemId: z.union([z.string(), z.number()]),
  actualGrams: z
    .number({ message: "Vui lòng nhập định lượng cân thực tế." })
    .positive({ message: "Định lượng cân thực tế phải lớn hơn 0." })
    .max(10000, { message: "Định lượng tối đa 10,000g." }),
  lotCode: z.string().trim().min(1, { message: "Mã lô không được để trống." }).max(100),
  supplierNote: z.string().trim().max(500).optional().nullable(),
  cookedBatchId: z.string().trim().max(100).optional().nullable(),
});

/**
 * Schema cập nhật trạng thái đơn (Admin Status)
 */
export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    "awaiting_payment",
    "pending_verification",
    "paid",
    "cooking",
    "packed",
    "delivered",
    "cancelled",
  ]),
});

/**
 * Schema quản lý nguyên liệu (Admin Ingredients)
 */
export const ingredientSchema = z.object({
  name: z.string().trim().min(1, { message: "Tên nguyên liệu không được để trống." }).max(200),
  kcal_per100: z.number().min(0, { message: "Calories phải lớn hơn hoặc bằng 0." }),
  protein_per100: z.number().min(0, { message: "Protein phải lớn hơn hoặc bằng 0." }),
  carbs_per100: z.number().min(0, { message: "Carbs phải lớn hơn hoặc bằng 0." }),
  fat_per100: z.number().min(0, { message: "Fat phải lớn hơn hoặc bằng 0." }),
  allergens: z.array(z.string().trim().max(100)).optional(),
  usda_fdc_id: z.string().trim().max(100).optional().nullable(),
  source: z.enum(["manual", "usda"]).optional(),
});

/**
 * Định dạng thông báo lỗi Zod thân thiện, không làm lộ stack trace
 */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "Dữ liệu đầu vào không hợp lệ.";
  return first.message || "Dữ liệu đầu vào không hợp lệ.";
}
