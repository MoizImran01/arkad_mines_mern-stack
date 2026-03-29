/**
 * Compresses an image file to JPEG base64 for upload
 */
export function compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.6, maxSizeBytes = 3 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const aspectRatio = width / height;
        if (width > height) {
          if (width > maxWidth) {
            width = maxWidth;
            height = Math.round(width / aspectRatio);
          }
        } else {
          if (height > maxHeight) {
            height = maxHeight;
            width = Math.round(height * aspectRatio);
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        ctx.drawImage(img, 0, 0, width, height);

        const readBlobAsDataUrl = (blob) => {
          const reader2 = new FileReader();
          reader2.onload = () => {
            const dataUrl = reader2.result;
            if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
              resolve(dataUrl);
            } else {
              reject(new Error("Invalid data URL format"));
            }
          };
          reader2.onerror = reject;
          reader2.readAsDataURL(blob);
        };

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob from canvas"));
              return;
            }
            if (blob.size > maxSizeBytes && quality > 0.3) {
              const canvas2 = document.createElement("canvas");
              canvas2.width = Math.round(width * 0.8);
              canvas2.height = Math.round(height * 0.8);
              const ctx2 = canvas2.getContext("2d");
              ctx2.drawImage(img, 0, 0, canvas2.width, canvas2.height);
              canvas2.toBlob(
                (blob2) => {
                  if (!blob2) {
                    reject(new Error("Failed to create blob from canvas"));
                    return;
                  }
                  readBlobAsDataUrl(blob2);
                },
                "image/jpeg",
                0.5
              );
              return;
            }
            readBlobAsDataUrl(blob);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
