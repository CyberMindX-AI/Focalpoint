import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { UploadFile } from '../domain/materialFiles';

const maxDimension = 3200;

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number } | null>(resolve => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
  });
}

/** Same limit as the website: keep text and diagrams legible without enlarging a photo. */
export async function prepareUploadPhoto(file: UploadFile & { width?: number; height?: number }): Promise<UploadFile> {
  const photo = file.mime.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|webp|bmp|tif|tiff)$/i.test(file.name);
  if (!photo) return file;
  try {
    const size = file.width && file.height ? { width: file.width, height: file.height } : await imageSize(file.uri);
    if (!size) return file;
    const ratio = Math.min(1, maxDimension / Math.max(size.width, size.height));
    if (ratio >= 1) return file;
    const context = ImageManipulator.manipulate(file.uri);
    context.resize({ width: Math.max(1, Math.round(size.width * ratio)), height: Math.max(1, Math.round(size.height * ratio)) });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
    return { uri: saved.uri, name: file.name.replace(/\.[^.]+$/, '.jpg'), mime: 'image/jpeg' };
  } catch {
    return file;
  }
}
