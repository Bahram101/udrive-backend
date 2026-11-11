import type { PriceZone } from "@/generated/prisma/client";
import { BASE_PRICE } from "@/lib/constants";

function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[],
): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

export function resolveZoneModifier(
  point: { lat: number; lng: number },
  zones: PriceZone[],
): number {
  let maxModifier = 0;

  for (const zone of zones) {
    if (!zone.isActive) continue;

    // Prisma типизирует Json-колонку как Prisma.JsonValue; приводим к структуре полигона, валидируемой при записи
    const points = zone.points as unknown as { lat: number; lng: number }[];

    if (isPointInPolygon(point, points) && zone.priceModifier > maxModifier) {
      maxModifier = zone.priceModifier;
    }
  }

  return maxModifier;
}

export function calculateOrderPrice(
  zones: PriceZone[],
  from: { lat: number; lng: number },
  to?: { lat: number; lng: number },
): number {
  return (
    BASE_PRICE +
    resolveZoneModifier(from, zones) +
    (to ? resolveZoneModifier(to, zones) : 0)
  );
}
