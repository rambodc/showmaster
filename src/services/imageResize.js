import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export const SQUARE_IMAGE_SIZES = [
  { key: 'sm', size: 64 },
  { key: 'md', size: 128 },
  { key: 'lg', size: 256 },
];

export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load the selected image.'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, type = 'image/webp', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to process image.'));
    }, type, quality);
  });
}

async function buildSquareBlob(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const srcSize = Math.min(srcW, srcH);
  const sx = Math.floor((srcW - srcSize) / 2);
  const sy = Math.floor((srcH - srcSize) / 2);

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
  return canvasToBlob(canvas);
}

export async function uploadSquareImageSet({ storage, file, basePath, prefix }) {
  const img = await fileToImage(file);
  const urls = {};
  const stamp = Date.now();
  for (const { key, size } of SQUARE_IMAGE_SIZES) {
    const blob = await buildSquareBlob(img, size);
    const imageRef = ref(storage, `${basePath}/${key}-${prefix}-${stamp}.webp`);
    await uploadBytes(imageRef, blob, {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
    });
    urls[key] = await getDownloadURL(imageRef);
  }
  return urls;
}
