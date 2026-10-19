const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Distancia em metros entre duas coordenadas (formula de Haversine, sem
 * chamada externa). So tem uso real quando ClientNetworkLocation tiver
 * latitude/longitude preenchidos -- hoje nenhuma fonte de dado do backend
 * fornece isso (ver types.ts), entao esta funcao fica pronta mas inerte.
 */
export function distanceInMeters(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function isWithinRadius(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
  radiusMeters: number
): boolean {
  return distanceInMeters(latA, lonA, latB, lonB) <= radiusMeters;
}
