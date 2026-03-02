import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

/**
 * Request permission and launch the image library picker.
 * Returns the selected image URI, or null if cancelled/denied.
 */
export async function pickImage(
  options?: { aspect?: [number, number] },
): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow access to your photo library.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: options?.aspect ?? [1, 1],
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
}

/**
 * Upload a local image URI to Supabase Storage.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadImage(
  uri: string,
  bucket: string,
  filePath: string,
): Promise<string | null> {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';

  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, arrayBuffer, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    });

  if (error) {
    console.warn(`Image upload to ${bucket} failed:`, error.message);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
