import { z } from "zod";

// ==========================================
// Enums
// ==========================================

export enum UserRole {
  OWNER = "OWNER",
  WAITER = "WAITER",
  KITCHEN = "KITCHEN",
}

export enum OrderStatus {
  PENDING = "PENDING",
  PREPARING = "PREPARING",
  READY = "READY",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
}

// ==========================================
// Zod Enums & Schemas
// ==========================================

export const UserRoleSchema = z.nativeEnum(UserRole);
export const OrderStatusSchema = z.nativeEnum(OrderStatus);
export const PaymentStatusSchema = z.nativeEnum(PaymentStatus);

export const RestaurantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Restaurant name is required"),
  location: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  role: UserRoleSchema,
  email: z.string().email(),
  pinCode: z.string().min(4).max(6),
  name: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export const MenuCategorySchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().min(1),
  orderIndex: z.number().int().default(0),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export const MenuItemSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  price: z.number().or(z.string()),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  isAvailable: z.boolean().default(true),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().nullable().optional(),
  unitPrice: z.number().or(z.string()).optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  tableNumber: z.string(),
  status: OrderStatusSchema.default(OrderStatus.PENDING),
  totalAmount: z.number().or(z.string()),
  paymentStatus: PaymentStatusSchema.default(PaymentStatus.UNPAID),
  items: z.array(OrderItemSchema).optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

// ==========================================
// DTO & Input Schemas
// ==========================================

export const CreateRestaurantSchema = RestaurantSchema.pick({
  name: true,
  location: true,
});

export const CreateUserSchema = UserSchema.pick({
  restaurantId: true,
  role: true,
  email: true,
  pinCode: true,
  name: true,
});

export const CreateMenuCategorySchema = MenuCategorySchema.pick({
  restaurantId: true,
  name: true,
  orderIndex: true,
});

export const CreateMenuItemSchema = MenuItemSchema.pick({
  categoryId: true,
  name: true,
  price: true,
  description: true,
  imageUrl: true,
  isAvailable: true,
});

export const CreateOrderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  tableNumber: z.string().min(1),
  items: z.array(CreateOrderItemInputSchema).min(1, "At least one item is required"),
});

export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusSchema,
});

// ==========================================
// Inferred TypeScript Types
// ==========================================

export type IRestaurant = z.infer<typeof RestaurantSchema>;
export type IUser = z.infer<typeof UserSchema>;
export type IMenuCategory = z.infer<typeof MenuCategorySchema>;
export type IMenuItem = z.infer<typeof MenuItemSchema>;
export type IOrderItem = z.infer<typeof OrderItemSchema>;
export type IOrder = z.infer<typeof OrderSchema>;

export type CreateRestaurantInput = z.infer<typeof CreateRestaurantSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type CreateMenuCategoryInput = z.infer<typeof CreateMenuCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;
export type CreateOrderItemInput = z.infer<typeof CreateOrderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

// ==========================================
// Generic API Responses
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  database: {
    connected: boolean;
    restaurantCount: number;
    error?: string;
  };
}
