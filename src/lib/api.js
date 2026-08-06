import { httpsCallable } from 'firebase/functions';
import { functions } from '../core/firebase';

const getMyProfile = httpsCallable(functions, 'getMyProfile');

export async function fetchMyProfile() {
  const response = await getMyProfile();
  return response.data;
}
