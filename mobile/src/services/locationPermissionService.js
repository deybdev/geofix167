import * as Location from 'expo-location';

export async function getMapLocationPermissionParams() {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    const granted = permission.status === 'granted';
    return {
      locationPermissionHandled: true,
      locationSharingOff: !granted,
    };
  } catch {
    return {
      locationPermissionHandled: true,
      locationSharingOff: true,
    };
  }
}
