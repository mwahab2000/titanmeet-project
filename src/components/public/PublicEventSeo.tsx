import { useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { buildPublicEventUrlAbsolute } from "@/lib/subdomain";

interface Props {
  data: PublicEventData;
}

/**
 * Sets document title, meta description, OG tags, and canonical link
 * for public event pages. Cleans up on unmount.
 */
export const PublicEventSeo = ({ data }: Props) => {
  useEffect(() => {
    const { client, event, hero } = data;
    const canonical = buildPublicEventUrlAbsolute(client.slug, event.slug);
    const title = `${event.title} — ${client.name}`;
    const description =
      event.description?.slice(0, 155) ?? `Join ${event.title} by ${client.name}`;

    // Title
    const prevTitle = document.title;
    document.title = title;

    // Canonical
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const hadCanonical = !!link;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;

    // Helper to set/create meta
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:type", "website");
    if (hero.images?.[0]) {
      setMeta("property", "og:image", hero.images[0]);
    }

    return () => {
      document.title = prevTitle;
      if (!hadCanonical) {
        link?.remove();
      }
    };
  }, [data]);

  return null;
};
