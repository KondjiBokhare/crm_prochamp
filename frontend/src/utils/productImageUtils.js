const MAX_UPLOAD_IMAGES = 5;
const MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 120 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read image "${file.name}". Choose a valid JPG, PNG or WebP image.`));
    };
    image.src = objectUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The browser could not prepare the selected image."));
    reader.readAsDataURL(blob);
  });
}

export async function compressProductImage(file) {
  if (!file) throw new Error("Choose an image file.");
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error(`"${file.name}" is not supported. Choose JPG, PNG or WebP.`);
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error(`"${file.name}" is larger than 8 MB. Choose a smaller image.`);
  }

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error(`"${file.name}" does not contain a valid image.`);

  let maxDimension = 1200;
  let resultBlob = null;
  for (let resizePass = 0; resizePass < 4; resizePass += 1) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image compression is not supported by this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.78, 0.68, 0.58, 0.48]) {
      // Browsers without WebP encode to a fallback image format. The catalogue
      // validator accepts only safe raster data URLs (WebP/JPEG/PNG).
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob) continue;
      resultBlob = blob;
      if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break;
    }
    canvas.width = 0;
    canvas.height = 0;
    if (resultBlob && resultBlob.size <= MAX_COMPRESSED_IMAGE_BYTES) break;
    resultBlob = null;
    maxDimension = Math.round(maxDimension * 0.78);
  }

  if (!resultBlob) {
    throw new Error(`Could not compress "${file.name}" below 120 KB. Choose a smaller image.`);
  }
  const dataUrl = await blobToDataUrl(resultBlob);
  if (!/^data:image\/(webp|jpeg|png);base64,/i.test(dataUrl)) {
    throw new Error(`The browser returned an unsupported format for "${file.name}".`);
  }
  return dataUrl;
}

export function formatImageBytes(dataUrl) {
  if (!dataUrl) return "0 KB";
  const comma = dataUrl.indexOf(",");
  const encodedLength = comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length;
  const bytes = Math.max(0, Math.floor(encodedLength * 0.75));
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
}

export const productImageLimits = {
  maxImages: MAX_UPLOAD_IMAGES,
  maxSourceFileBytes: MAX_SOURCE_FILE_BYTES,
  maxCompressedImageBytes: MAX_COMPRESSED_IMAGE_BYTES,
};
