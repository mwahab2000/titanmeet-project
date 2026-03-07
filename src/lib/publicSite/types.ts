export interface PublicDressCode {
  dayNumber: number;
  dressType: string;
  customInstructions: string | null;
  referenceImages: string[];
}

export interface PublicTransportStop {
  id: string;
  name: string;
  address: string | null;
  pickupTime: string | null;
  stopType: string;
  mapUrl: string | null;
  notes: string | null;
}

export interface PublicTransportRoute {
  id: string;
  name: string;
  dayNumber: number | null;
  departureTime: string | null;
  vehicleType: string | null;
  notes: string | null;
  stops: PublicTransportStop[];
}

export interface PublicTransportData {
  enabled: boolean;
  generalInstructions: string | null;
  meetupTime: string | null;
  routes: PublicTransportRoute[];
}

export interface PublicEventData {
  client: { id: string; name: string; slug: string; logoUrl: string | null };
  event: { id: string; title: string; slug: string; description: string | null; date: string | null; status: string; themeId: string };
  hero: { title: string; description: string | null; images: string[]; date: string | null; venueName: string | null };
  agenda: Array<{ id: string; title: string; description: string | null; startTime: string | null; endTime: string | null; dayNumber: number; speakerName: string | null }>;
  speakers: Array<{ id: string; name: string; title: string | null; bio: string | null; photoUrl: string | null; linkedinUrl: string | null; gender: string }>;
  venue: { name: string | null; address: string | null; notes: string | null; mapLink: string | null; images: string[] };
  organizers: Array<{ id: string; name: string; role: string | null; email: string | null; mobile: string | null; photoUrl: string | null }>;
  announcements: Array<{ id: string; text: string }>;
  gallery: string[];
  dressCode: PublicDressCode[];
  transport: PublicTransportData;
  surveys: { hasSurvey: boolean };
}

export type FetchResult =
  | { status: "ok"; data: PublicEventData }
  | { status: "not_found" }
  | { status: "private" }
  | { status: "error"; message: string };
