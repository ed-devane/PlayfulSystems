// Phone photos are huge. Shrink them before sending, keeping handwriting readable.

import { PHOTO } from '../config.js';

export async function shrinkPhoto(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    throw new Error('Couldn’t open that picture. Use a JPEG or PNG.', { cause: e });
  }
  const scale = Math.min(1, PHOTO.maxEdgePixels / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', PHOTO.jpegQuality);
}
