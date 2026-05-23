import { describe, expect, it } from "vitest";
import {
  computeOverdueNotifications,
  createListing,
  reserveListing,
  sendMessage,
  updateReservationStatus
} from "./store";
import { seedState } from "./seed";
import type { AppState, ListingDraft } from "./types";

const draft: ListingDraft = {
  title: "Road bike",
  description: "Aluminum frame, recently tuned.",
  price: 420,
  category: "Outdoor",
  condition: "good",
  location: "Local pickup",
  images: [
    {
      id: "draft-image",
      name: "bike.png",
      dataUrl: "data:image/png;base64,bike",
      primary: false,
      createdAt: "2026-05-23T10:00:00.000Z"
    }
  ]
};

describe("store state transitions", () => {
  it("creates a listing with image metadata and available status", () => {
    const next = createListing(seedState, "seller-1", draft);
    const listing = next.listings[0];

    expect(listing.title).toBe("Road bike");
    expect(listing.status).toBe("available");
    expect(listing.images).toHaveLength(1);
    expect(listing.images[0].primary).toBe(true);
  });

  it("reserves an available listing once and prevents a second reservation", () => {
    const first = reserveListing(seedState, "listing-1", "buyer-1");
    const second = reserveListing(first, "listing-1", "buyer-2");

    expect(first.listings.find((listing) => listing.id === "listing-1")?.status).toBe("reserved");
    expect(first.reservations).toHaveLength(seedState.reservations.length + 1);
    expect(second.reservations).toHaveLength(first.reservations.length);
  });

  it("does not let a seller reserve their own listing", () => {
    const next = reserveListing(seedState, "listing-1", "seller-1");

    expect(next).toBe(seedState);
  });

  it("stores chat messages only for reservation participants", () => {
    const allowed = sendMessage(seedState, "reservation-1", "buyer-1", "Still available?");
    const denied = sendMessage(seedState, "reservation-1", "buyer-2", "Can I see this?");

    expect(allowed.messages).toHaveLength(seedState.messages.length + 1);
    expect(denied.messages).toHaveLength(seedState.messages.length);
  });

  it("enforces manual payment permissions", () => {
    const buyerPaid = updateReservationStatus(seedState, "reservation-1", "buyer-1", "paid");
    const sellerPaid = updateReservationStatus(seedState, "reservation-1", "seller-1", "paid");
    const cancelledAfterPaid = updateReservationStatus(sellerPaid, "reservation-1", "seller-1", "cancelled");

    expect(buyerPaid.reservations[0].status).toBe("awaiting_payment");
    expect(sellerPaid.reservations[0].status).toBe("paid");
    expect(cancelledAfterPaid.reservations[0].status).toBe("paid");
    expect(cancelledAfterPaid.listings.find((listing) => listing.id === "listing-2")?.status).toBe("sold");
  });

  it("creates overdue notifications once per overdue reservation", () => {
    const base: AppState = {
      ...seedState,
      notifications: [],
      reservations: [
        {
          ...seedState.reservations[0],
          status: "awaiting_payment",
          overdueNotifiedAt: undefined,
          paymentDueAt: "2026-05-22T10:00:00.000Z"
        }
      ]
    };

    const first = computeOverdueNotifications(base, new Date("2026-05-23T10:00:00.000Z"));
    const second = computeOverdueNotifications(first, new Date("2026-05-23T10:05:00.000Z"));

    expect(first.reservations[0].status).toBe("overdue");
    expect(first.notifications).toHaveLength(2);
    expect(second.notifications).toHaveLength(2);
  });

  it("does not create overdue notifications for paid or already-notified reservations", () => {
    const base: AppState = {
      ...seedState,
      notifications: [],
      reservations: [
        {
          ...seedState.reservations[0],
          id: "reservation-paid",
          status: "paid",
          overdueNotifiedAt: undefined,
          paymentDueAt: "2026-05-22T10:00:00.000Z"
        },
        {
          ...seedState.reservations[0],
          id: "reservation-already-notified",
          status: "awaiting_payment",
          overdueNotifiedAt: "2026-05-22T11:00:00.000Z",
          paymentDueAt: "2026-05-22T10:00:00.000Z"
        }
      ]
    };

    const next = computeOverdueNotifications(base, new Date("2026-05-23T10:00:00.000Z"));

    expect(next).toBe(base);
    expect(next.notifications).toHaveLength(0);
  });
});
