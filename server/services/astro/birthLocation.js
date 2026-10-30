import { InvalidPlaceError, resolveCoordinates } from "./geocode.js";

export { InvalidPlaceError };

const roundToKilometer = (coordinate) => Math.round(coordinate * 100) / 100;

export async function normalizeBirthLocation(profile) {
  const { birthLatitude, birthLongitude, birthTimezone } = profile;

  if (birthLatitude == null && birthLongitude == null) {
    if (birthLatitude === null || birthLongitude === null) {
      return {
        ...profile,
        birthLatitude: null,
        birthLongitude: null,
        birthTimezone: "",
      };
    }
    return profile;
  }

  const place = await resolveCoordinates({
    lat: birthLatitude,
    lon: birthLongitude,
    timeZone: birthTimezone,
    label: profile.placeOfBirth,
  });

  return {
    ...profile,
    birthLatitude: roundToKilometer(place.lat),
    birthLongitude: roundToKilometer(place.lon),
    birthTimezone: place.timeZone,
  };
}
