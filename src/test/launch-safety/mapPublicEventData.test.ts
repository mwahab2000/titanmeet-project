/**
 * LAUNCH SAFETY — Public Event Data Mapping
 *
 * Protects against accidental PII exposure in public event payloads.
 */
import { describe, it, expect } from "vitest";
import { mapPublicEventData } from "@/lib/publicSite/mapPublicEventData";

// Minimal fixtures
const mockClient = { id: "c1", name: "Acme Corp", slug: "acme", logo_url: null };

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    id: "e1",
    title: "Launch Party",
    slug: "launch",
    description: "A great event",
    event_date: "2026-06-01",
    status: "published",
    theme_id: "corporate",
    venue_name: "Grand Hall",
    venue_address: "123 Main St",
    venue_notes: null,
    venue_map_link: null,
    location: null,
    hero_images: [],
    venue_images: [],
    gallery_images: [],
    show_attendees_publicly: false,
    ...overrides,
  };
}

const mockOrganizers = [
  { id: "o1", name: "Jane Doe", role: "Lead", photo_url: null, email: "jane@example.com", mobile: "+1234567890" },
  { id: "o2", name: "John Smith", role: "Support", photo_url: null, email: "john@example.com", mobile: "+0987654321" },
];

const speakerMap = new Map<string, string>();

describe("mapPublicEventData — Privacy", () => {
  it("strips organizer email and mobile from public output", () => {
    const result = mapPublicEventData(
      mockClient, makeEvent(), [], [], mockOrganizers, [], 0, speakerMap,
    );

    result.organizers.forEach((org) => {
      expect(org.email).toBeNull();
      expect(org.mobile).toBeNull();
    });
    // Name and role should still be present
    expect(result.organizers[0].name).toBe("Jane Doe");
    expect(result.organizers[0].role).toBe("Lead");
  });

  it("returns empty attendees when no attendee data is passed", () => {
    const result = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 0, speakerMap,
    );

    expect(result.attendees.groups).toEqual([]);
  });

  it("returns attendee names when data is explicitly provided", () => {
    const attendees = [
      { id: "a1", name: "Alice" },
      { id: "a2", name: "Bob" },
    ];
    const result = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 0, speakerMap,
      [], null, [], [], attendees, [], [],
    );

    const allNames = result.attendees.groups.flatMap((g) => g.names);
    expect(allNames).toContain("Alice");
    expect(allNames).toContain("Bob");
  });

  it("filters out attendees with empty names", () => {
    const attendees = [
      { id: "a1", name: "Alice" },
      { id: "a2", name: "" },
      { id: "a3", name: "   " },
    ];
    const result = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 0, speakerMap,
      [], null, [], [], attendees, [], [],
    );

    const allNames = result.attendees.groups.flatMap((g) => g.names);
    expect(allNames).toEqual(["Alice"]);
  });

  it("groups attendees correctly when groups and assignments are provided", () => {
    const attendees = [
      { id: "a1", name: "Alice" },
      { id: "a2", name: "Bob" },
      { id: "a3", name: "Charlie" },
    ];
    const groups = [
      { id: "g1", name: "VIP" },
      { id: "g2", name: "General" },
    ];
    const attendeeGroups = [
      { attendee_id: "a1", group_id: "g1" },
      { attendee_id: "a2", group_id: "g2" },
      // a3 is ungrouped
    ];

    const result = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 0, speakerMap,
      [], null, [], [], attendees, groups, attendeeGroups,
    );

    expect(result.attendees.hasGroups).toBe(true);
    const vipGroup = result.attendees.groups.find((g) => g.name === "VIP");
    expect(vipGroup?.names).toEqual(["Alice"]);
    const generalGroup = result.attendees.groups.find((g) => g.name === "General");
    expect(generalGroup?.names).toEqual(["Bob"]);
    const otherGroup = result.attendees.groups.find((g) => g.name === "Other");
    expect(otherGroup?.names).toEqual(["Charlie"]);
  });
});

describe("mapPublicEventData — Event Fields", () => {
  it("maps core event fields correctly", () => {
    const result = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 0, speakerMap,
    );

    expect(result.event.title).toBe("Launch Party");
    expect(result.event.slug).toBe("launch");
    expect(result.event.themeId).toBe("corporate");
    expect(result.client.name).toBe("Acme Corp");
    expect(result.client.slug).toBe("acme");
  });

  it("maps venue fields without leaking extra data", () => {
    const result = mapPublicEventData(
      mockClient, makeEvent({ venue_name: "Hall A", venue_address: "456 Elm" }),
      [], [], [], [], 0, speakerMap,
    );

    expect(result.venue.name).toBe("Hall A");
    expect(result.venue.address).toBe("456 Elm");
  });

  it("handles null/missing optional fields gracefully", () => {
    const result = mapPublicEventData(
      mockClient, makeEvent({ description: null, venue_name: null }),
      [], [], [], [], 0, speakerMap,
    );

    expect(result.event.description).toBeNull();
    expect(result.venue.name).toBeNull();
    expect(result.hero.description).toBeNull();
  });

  it("maps agenda items with speaker names", () => {
    const speakers = [{ id: "s1", name: "Dr. Smith", title: "Prof", bio: null, photo_url: null, linkedin_url: null }];
    const sMap = new Map([["s1", "Dr. Smith"]]);
    const agenda = [
      { id: "ag1", title: "Keynote", description: "Opening", start_time: "09:00", end_time: "10:00", day_number: 1, speaker_id: "s1" },
      { id: "ag2", title: "Break", description: null, start_time: "10:00", end_time: "10:30", day_number: 1, speaker_id: null },
    ];

    const result = mapPublicEventData(
      mockClient, makeEvent(), agenda, speakers, [], [], 0, sMap,
    );

    expect(result.agenda[0].speakerName).toBe("Dr. Smith");
    expect(result.agenda[1].speakerName).toBeNull();
  });

  it("reports survey availability correctly", () => {
    const withSurvey = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 3, speakerMap,
    );
    expect(withSurvey.surveys.hasSurvey).toBe(true);

    const withoutSurvey = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 0, speakerMap,
    );
    expect(withoutSurvey.surveys.hasSurvey).toBe(false);
  });

  it("maps transport data with routes and stops", () => {
    const transportSettings = { enabled: true, general_instructions: "Meet at lobby", meetup_time: "08:00" };
    const routes = [{ id: "r1", name: "Route A", day_number: 1, departure_time: "08:30", vehicle_type: "bus", notes: null }];
    const stops = [
      { id: "st1", name: "Hotel", address: "1 Main St", pickup_time: "08:00", stop_type: "pickup", map_url: null, notes: null, route_id: "r1", order_index: 0 },
    ];

    const result = mapPublicEventData(
      mockClient, makeEvent(), [], [], [], [], 0, speakerMap,
      [], transportSettings, routes, stops,
    );

    expect(result.transport.enabled).toBe(true);
    expect(result.transport.routes).toHaveLength(1);
    expect(result.transport.routes[0].stops).toHaveLength(1);
    expect(result.transport.routes[0].stops[0].name).toBe("Hotel");
  });
});
