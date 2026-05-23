import { seedState } from "./seed";
import { createLocalStorageResource } from "../lib/storage";
import type {
  AppState,
  Listing,
  ListingDraft,
  Message,
  Notification,
  Reservation
} from "./types";

const STORAGE_KEY = "resell-platform:v1";
const STORAGE_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

const stateResource = createLocalStorageResource<AppState>({
  key: STORAGE_KEY,
  version: STORAGE_VERSION,
  defaultValue: seedState,
  validate: isAppState
});

export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

export function loadState(): AppState {
  return stateResource.load();
}

export function saveState(state: AppState): void {
  stateResource.save(state);
}

export function resetState(): AppState {
  return stateResource.reset().data;
}

export function getPrimaryImage(listing: Listing): string | undefined {
  return listing.images.find((image) => image.primary)?.dataUrl ?? listing.images[0]?.dataUrl;
}

export function createListing(state: AppState, sellerId: string, draft: ListingDraft): AppState {
  const now = new Date().toISOString();
  const listing: Listing = {
    ...draft,
    id: createId("listing"),
    sellerId,
    status: "available",
    createdAt: now,
    updatedAt: now,
    images: draft.images.map((image, index) => ({
      ...image,
      primary: index === 0
    }))
  };

  return {
    ...state,
    listings: [listing, ...state.listings]
  };
}

export function reserveListing(state: AppState, listingId: string, buyerId: string): AppState {
  const listing = state.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "available" || listing.sellerId === buyerId) {
    return state;
  }

  const now = new Date();
  const reservation: Reservation = {
    id: createId("reservation"),
    listingId,
    buyerId,
    sellerId: listing.sellerId,
    status: "awaiting_payment",
    paymentDueAt: new Date(now.getTime() + DAY_MS).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const notification: Notification = {
    id: createId("notification"),
    userId: listing.sellerId,
    type: "reservation_created",
    title: "New reservation",
    body: `${getUserName(state, buyerId)} reserved ${listing.title}.`,
    entityId: reservation.id,
    createdAt: now.toISOString()
  };

  return {
    ...state,
    listings: state.listings.map((item) =>
      item.id === listingId ? { ...item, status: "reserved", updatedAt: now.toISOString() } : item
    ),
    reservations: [reservation, ...state.reservations],
    notifications: [notification, ...state.notifications]
  };
}

export function sendMessage(
  state: AppState,
  reservationId: string,
  senderId: string,
  body: string
): AppState {
  const reservation = state.reservations.find((item) => item.id === reservationId);
  const trimmed = body.trim();
  if (!reservation || !trimmed || !canAccessReservation(reservation, senderId)) {
    return state;
  }

  const now = new Date().toISOString();
  const receiverId = reservation.sellerId === senderId ? reservation.buyerId : reservation.sellerId;
  const listing = state.listings.find((item) => item.id === reservation.listingId);
  const message: Message = {
    id: createId("message"),
    reservationId,
    senderId,
    body: trimmed,
    createdAt: now
  };
  const notification: Notification = {
    id: createId("notification"),
    userId: receiverId,
    type: "message_received",
    title: "New message",
    body: `${getUserName(state, senderId)} sent a message about ${listing?.title ?? "a listing"}.`,
    entityId: reservationId,
    createdAt: now
  };

  return {
    ...state,
    messages: [...state.messages, message],
    notifications: [notification, ...state.notifications]
  };
}

export function updateReservationStatus(
  state: AppState,
  reservationId: string,
  actorId: string,
  status: Reservation["status"]
): AppState {
  const reservation = state.reservations.find((item) => item.id === reservationId);
  if (!reservation || !canAccessReservation(reservation, actorId)) return state;
  if (["paid", "sold", "cancelled"].includes(reservation.status)) return state;
  if (status === "paid" || status === "sold") {
    if (actorId !== reservation.sellerId) return state;
  }
  if (status === "payment_sent" && actorId !== reservation.buyerId) return state;

  const now = new Date().toISOString();
  const nextListings = state.listings.map((listing) => {
    if (listing.id !== reservation.listingId) return listing;
    if (status === "sold" || status === "paid") {
      return { ...listing, status: "sold" as const, updatedAt: now };
    }
    if (status === "cancelled") {
      return { ...listing, status: "available" as const, updatedAt: now };
    }
    return listing;
  });

  const notifications =
    status === "paid"
      ? [
          {
            id: createId("notification"),
            userId: reservation.buyerId,
            type: "payment_paid" as const,
            title: "Payment confirmed",
            body: "The seller marked your off-platform payment as received.",
            entityId: reservationId,
            createdAt: now
          },
          ...state.notifications
        ]
      : state.notifications;

  return {
    ...state,
    listings: nextListings,
    reservations: state.reservations.map((item) =>
      item.id === reservationId ? { ...item, status, updatedAt: now } : item
    ),
    notifications
  };
}

export function computeOverdueNotifications(state: AppState, now = new Date()): AppState {
  const createdNotifications: Notification[] = [];
  const reservations = state.reservations.map((reservation) => {
    const shouldNotify =
      reservation.status === "awaiting_payment" &&
      !reservation.overdueNotifiedAt &&
      new Date(reservation.paymentDueAt).getTime() <= now.getTime();

    if (!shouldNotify) return reservation;

    const listing = state.listings.find((item) => item.id === reservation.listingId);
    const timestamp = now.toISOString();
    createdNotifications.push(
      {
        id: createId("notification"),
        userId: reservation.buyerId,
        type: "payment_overdue",
        title: "Payment overdue",
        body: `Payment is overdue for ${listing?.title ?? "your reserved item"}.`,
        entityId: reservation.id,
        createdAt: timestamp
      },
      {
        id: createId("notification"),
        userId: reservation.sellerId,
        type: "payment_overdue",
        title: "Payment overdue",
        body: `${getUserName(state, reservation.buyerId)} has not been marked paid for ${
          listing?.title ?? "a reserved item"
        }.`,
        entityId: reservation.id,
        createdAt: timestamp
      }
    );

    return {
      ...reservation,
      status: "overdue" as const,
      overdueNotifiedAt: timestamp,
      updatedAt: timestamp
    };
  });

  if (createdNotifications.length === 0) return state;

  return {
    ...state,
    reservations,
    notifications: [...createdNotifications, ...state.notifications]
  };
}

export function canAccessReservation(reservation: Reservation, userId: string): boolean {
  return reservation.buyerId === userId || reservation.sellerId === userId;
}

export function getUserName(state: AppState, userId: string): string {
  return state.users.find((user) => user.id === userId)?.name ?? "Someone";
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppState>;
  return (
    Array.isArray(candidate.users) &&
    typeof candidate.activeUserId === "string" &&
    Array.isArray(candidate.listings) &&
    Array.isArray(candidate.reservations) &&
    Array.isArray(candidate.messages) &&
    Array.isArray(candidate.notifications)
  );
}
