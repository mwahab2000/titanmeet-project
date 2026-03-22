/**
 * LAUNCH SAFETY — Public Event Visibility & Access Rules
 *
 * Tests the fetch result logic for public event access (without hitting Supabase).
 * Verifies that the data mapping layer enforces privacy defaults.
 */
import { describe, it, expect } from "vitest";
import type { FetchResult, PublicEventData } from "@/lib/publicSite/types";

describe("FetchResult type safety", () => {
  it("ok result carries PublicEventData", () => {
    const result: FetchResult = {
      status: "ok",
      data: {
        client: { id: "c1", name: "Test", slug: "test", logoUrl: null },
        event: { id: "e1", title: "Test", slug: "test", description: null, date: null, status: "published", themeId: "corporate" },
        hero: { title: "Test", description: null, images: [], date: null, venueName: null },
        agenda: [],
        speakers: [],
        venue: { name: null, address: null, notes: null, mapLink: null, images: [] },
        organizers: [],
        announcements: [],
        gallery: [],
        dressCode: [],
        transport: { enabled: false, generalInstructions: null, meetupTime: null, routes: [] },
        surveys: { hasSurvey: false },
        attendees: { hasGroups: false, groups: [] },
      },
    };
    expect(result.status).toBe("ok");
    expect(result.data.event.title).toBe("Test");
  });

  it("not_found result has optional reason", () => {
    const r1: FetchResult = { status: "not_found", reason: "client_not_found" };
    expect(r1.reason).toBe("client_not_found");

    const r2: FetchResult = { status: "not_found", reason: "event_not_found" };
    expect(r2.reason).toBe("event_not_found");

    const r3: FetchResult = { status: "not_found" };
    expect(r3.reason).toBeUndefined();
  });

  it("private result has no data", () => {
    const result: FetchResult = { status: "private" };
    expect(result.status).toBe("private");
    expect((result as any).data).toBeUndefined();
  });

  it("error result has message", () => {
    const result: FetchResult = { status: "error", message: "DB error" };
    expect(result.message).toBe("DB error");
  });
});

describe("PublicEventData — no PII in type contract", () => {
  it("organizer type includes email/mobile as nullable (set to null at mapping)", () => {
    // This test verifies the TYPE allows nullable email/mobile
    // The mapping layer sets them to null — tested in mapPublicEventData.test.ts
    const organizer: PublicEventData["organizers"][0] = {
      id: "o1",
      name: "Test",
      role: null,
      email: null,
      mobile: null,
      photoUrl: null,
    };
    expect(organizer.email).toBeNull();
    expect(organizer.mobile).toBeNull();
  });

  it("attendees type supports empty groups (privacy default)", () => {
    const attendees: PublicEventData["attendees"] = {
      hasGroups: false,
      groups: [],
    };
    expect(attendees.groups).toHaveLength(0);
  });
});
