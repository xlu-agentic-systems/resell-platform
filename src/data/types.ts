export type UserRole = "buyer" | "seller";

export type User = {
  id: string;
  name: string;
  role: UserRole;
};

export type ListingStatus = "available" | "reserved" | "sold" | "paused";
export type ListingCondition = "new" | "like_new" | "good" | "fair";

export type ListingImage = {
  id: string;
  name: string;
  dataUrl: string;
  primary: boolean;
  createdAt: string;
};

export type Listing = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: ListingCondition;
  location: string;
  images: ListingImage[];
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReservationStatus =
  | "requested"
  | "awaiting_payment"
  | "payment_sent"
  | "paid"
  | "overdue"
  | "cancelled"
  | "sold";

export type Reservation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: ReservationStatus;
  paymentDueAt: string;
  overdueNotifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  reservationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type NotificationType =
  | "reservation_created"
  | "message_received"
  | "payment_due"
  | "payment_overdue"
  | "payment_paid";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityId?: string;
  readAt?: string;
  createdAt: string;
};

export type AppState = {
  users: User[];
  activeUserId: string;
  listings: Listing[];
  reservations: Reservation[];
  messages: Message[];
  notifications: Notification[];
};

export type ListingDraft = {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: ListingCondition;
  location: string;
  images: ListingImage[];
};

