"use client";

import QRCode from "qrcode";

/**
 * Compresses and resizes an uploaded image file in the browser using <canvas>
 * so owners can snap a 10MB phone photo and store it as a crisp ~50-90KB Data URL.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxSize = 640,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Định dạng ảnh không hợp lệ."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Trình duyệt không hỗ trợ xử lý ảnh."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Try webp first for smaller size, fallback to jpeg
        let out = canvas.toDataURL("image/webp", quality);
        if (!out.startsWith("data:image/webp")) {
          out = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(out);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Renders a printable Table QR sticker PNG (with store name, table badge, QR code, and call-to-action).
 */
export async function generateTableQrStickerDataUrl({
  url,
  storeName,
  tableLabel,
}: {
  url: string;
  storeName: string;
  tableLabel: string;
}): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 520,
    margin: 2,
    color: {
      dark: "#050505",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });

  return new Promise((resolve, reject) => {
    const qrImg = new Image();
    qrImg.onerror = () => reject(new Error("Không tạo được ảnh QR."));
    qrImg.onload = () => {
      const W = 720;
      const H = 920;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(qrDataUrl);
        return;
      }

      // Background dark card
      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, W, H);

      // Subtle border
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 24, W - 48, H - 48);

      // Store name header
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`🍜 ${storeName.toUpperCase()}`, W / 2, 100);

      // Table pill
      ctx.fillStyle = "#ffffff";
      const pillW = 320;
      const pillH = 64;
      const pillX = (W - pillW) / 2;
      const pillY = 130;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 32);
      ctx.fill();

      ctx.fillStyle = "#050505";
      ctx.font = "extrabold 30px sans-serif";
      ctx.fillText(tableLabel.toUpperCase(), W / 2, pillY + 43);

      // White QR container
      const qrBoxSize = 540;
      const qrBoxX = (W - qrBoxSize) / 2;
      const qrBoxY = 230;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 36);
      ctx.fill();

      ctx.drawImage(qrImg, qrBoxX + 20, qrBoxY + 20, qrBoxSize - 40, qrBoxSize - 40);

      // Footer instructions
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("QUÉT MÃ QR ĐỂ CHỌN MÓN TẠI BÀN", W / 2, 825);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "20px sans-serif";
      ctx.fillText("Không cần tải App • Chọn Topping • Đặt siêu tốc", W / 2, 862);

      resolve(canvas.toDataURL("image/png"));
    };
    qrImg.src = qrDataUrl;
  });
}

/** Plays a pleasant two-tone kitchen bell chime using Web Audio API (zero external assets). */
export function playKitchenBell() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [880, 1174.66]; // A5 -> D6 ("Ding - Dong!")
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.16);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + idx * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.16 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.16);
      osc.stop(ctx.currentTime + idx * 0.16 + 0.6);
    });
  } catch {
    /* audio may be blocked if user hasn't interacted yet */
  }
}

