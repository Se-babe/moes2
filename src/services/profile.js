import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabaseClient';

const BUCKET = 'avatars';
const SIZE = 320; // pixels; plenty for a profile picture and ~20–40 KB as JPEG

// Centre-crop to a square and shrink, so uploads are small and fast.
async function squareJpegWeb(uri) {
  const img = await new Promise((resolve, reject) => {
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That file could not be read as an image.'));
    el.src = uri;
  });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext('2d').drawImage(
    img,
    (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
    0, 0, SIZE, SIZE,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the image.'))), 'image/jpeg', 0.85));
}

/** Let the person choose a photo. Returns null if they cancel. */
export async function pickAvatar() {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Allow access to your photos to choose a profile picture.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

/**
 * Upload a profile picture for `userId` (their own, or anyone's for an admin)
 * and return its public URL. Older pictures in the folder are removed.
 */
export async function uploadAvatar(userId, asset) {
  const blob = Platform.OS === 'web'
    ? await squareJpegWeb(asset.uri)
    : await fetch(asset.uri).then((r) => r.blob());
  if (blob.size > 2 * 1024 * 1024) throw new Error('Please choose a picture smaller than 2 MB.');

  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  await removeOldAvatars(userId, path);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Delete every picture in the person's folder except `keep`. */
export async function removeOldAvatars(userId, keep = null) {
  const { data } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
  const old = (data || []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}
