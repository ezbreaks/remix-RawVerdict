export async function resizeImage(
  imageBase64: string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
    img.src = imageBase64;
  });
}

export async function processImage(
  imageBase64: string,
  cropBox: [number, number, number, number], // ymin, xmin, ymax, xmax (0-100)
  rotation: number,
  addBorder: boolean = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // 1. Calculate dimensions after rotation
      const isRotated = rotation === 90 || rotation === 270;
      const totalWidth = img.width;
      const totalHeight = img.height;

      // 2. Calculate crop coordinates (0-100 scale to pixels)
      // ymin, xmin, ymax, xmax
      let [ymin, xmin, ymax, xmax] = cropBox;
      
      // Expand crop by 2% to ensure we don't cut off edges
      // This helps with the "better job auto cropping" request
      const padding = 2;
      ymin = Math.max(0, ymin - padding);
      xmin = Math.max(0, xmin - padding);
      ymax = Math.min(100, ymax + padding);
      xmax = Math.min(100, xmax + padding);
      
      const cropX = (xmin / 100) * totalWidth;
      const cropY = (ymin / 100) * totalHeight;
      const cropW = ((xmax - xmin) / 100) * totalWidth;
      const cropH = ((ymax - ymin) / 100) * totalHeight;

      // Safety check
      if (cropW <= 0 || cropH <= 0) {
        resolve(imageBase64); // Return original if crop is invalid
        return;
      }

      // 3. Set canvas size based on ROTATED crop dimensions
      // If rotated 90/270, width becomes height
      canvas.width = isRotated ? cropH : cropW;
      canvas.height = isRotated ? cropW : cropH;

      // 4. Transform context for rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // Draw image centered in the rotated context
      // We need to draw the *cropped* portion.
      // Since we rotated the context, we need to be careful with drawImage params.
      // drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
      
      // When rotated:
      // The destination rectangle is centered at (0,0) in the rotated space.
      // Its dimensions in the rotated space are (cropW, cropH) if 0/180, or (cropH, cropW) if 90/270?
      // No, we rotated the context. 
      // If we rotate 90deg, the "up" direction of the canvas is now "right" of the image.
      // Let's simplify: Draw the FULL image rotated, then crop? No, inefficient.
      
      // Let's stick to standard canvas rotation logic:
      // 1. Translate to center.
      // 2. Rotate.
      // 3. Draw image offset by -width/2, -height/2.
      
      // But we are cropping too.
      // It's easier to crop first, then rotate? Or just do it in one go.
      
      // Let's try:
      // The source rectangle is always (cropX, cropY, cropW, cropH).
      // The destination rectangle in the *unrotated* canvas would be (0, 0, cropW, cropH).
      // But we want the result to be rotated.
      
      // If rotation is 0:
      // canvas.width = cropW, canvas.height = cropH
      // ctx.drawImage(img, cropX, cropY, cropW, cropH, -cropW/2, -cropH/2, cropW, cropH) -> wait, we translated to center.
      
      const drawW = cropW;
      const drawH = cropH;
      
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropW,
        cropH,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH
      );
      
      // 5. Add 2% black border
      // We can do this by drawing the canvas onto a *new* larger canvas, or just drawing a border *over* it?
      // "Crop the cards with a 2% black border" usually means the card image itself has a border added.
      // Let's create a second canvas for the border to be clean.
      
      if (addBorder) {
        const borderCanvas = document.createElement('canvas');
        const borderCtx = borderCanvas.getContext('2d');
        if (!borderCtx) {
           resolve(canvas.toDataURL('image/jpeg'));
           return;
        }
        
        const borderPct = 0.02;
        const finalW = canvas.width * (1 + borderPct * 2);
        const finalH = canvas.height * (1 + borderPct * 2);
        const borderX = canvas.width * borderPct;
        const borderY = canvas.height * borderPct;
        
        borderCanvas.width = finalW;
        borderCanvas.height = finalH;
        
        // Fill black
        borderCtx.fillStyle = '#000000';
        borderCtx.fillRect(0, 0, finalW, finalH);
        
        // Draw the rotated/cropped image in center
        borderCtx.drawImage(canvas, borderX, borderY);
        
        resolve(borderCanvas.toDataURL('image/jpeg'));
      } else {
        resolve(canvas.toDataURL('image/jpeg'));
      }
    };
    img.onerror = (err) => reject(err);
    img.src = imageBase64;
  });
}
