/**
 * LAUNCH SAFETY — Storage URL Extraction
 *
 * Ensures storage path extraction handles all URL formats safely
 * and does not leak internal paths or break on malformed input.
 */
import { describe, it, expect } from "vitest";
import { extractStoragePath } from "@/lib/storage";

describe("extractStoragePath", () => {
  it("returns relative path as-is", () => {
    expect(extractStoragePath("event-assets", "acme/events/photo.jpg"))
      .toBe("acme/events/photo.jpg");
  });

  it("extracts path from full public storage URL", () => {
    const url = "https://example.supabase.co/storage/v1/object/public/event-assets/acme/photo.jpg?token=abc";
    expect(extractStoragePath("event-assets", url)).toBe("acme/photo.jpg");
  });

  it("extracts path from signed storage URL", () => {
    const url = "https://example.supabase.co/storage/v1/object/sign/event-assets/acme/photo.jpg?token=xyz";
    expect(extractStoragePath("event-assets", url)).toBe("acme/photo.jpg");
  });

  it("returns null for external URLs", () => {
    expect(extractStoragePath("event-assets", "https://cdn.example.com/photo.jpg")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractStoragePath("event-assets", "")).toBeNull();
  });

  it("handles dress-code-images bucket", () => {
    const url = "https://x.supabase.co/storage/v1/object/public/dress-code-images/event123/img.png";
    expect(extractStoragePath("dress-code-images", url)).toBe("event123/img.png");
  });
});
