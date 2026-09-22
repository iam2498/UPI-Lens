const cameraBtn = document.getElementById("cameraBtn");
const cameraPanel = document.getElementById("cameraPanel");
const closeCamera = document.getElementById("closeCamera");
const cameraVideo = document.getElementById("cameraVideo");
const cameraStatus = document.getElementById("cameraStatus");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const errorBox = document.getElementById("error");
const upiIdEl = document.getElementById("upiId");
const detailsEl = document.getElementById("details");
const copyBtn = document.getElementById("copyBtn");
const scanAgain = document.getElementById("scanAgain");

let zxingReader = null;
let cameraStream = null;
let cameraScanning = false;

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) processFile(file);
});

["dragenter", "dragover"].forEach((event) => {
  dropZone.addEventListener(event, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((event) => {
  dropZone.addEventListener(event, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files?.[0];
  if (file) processFile(file);
});

copyBtn.addEventListener("click", async () => {
  const upiId = upiIdEl.textContent.trim();

  if (!upiId || upiId === "—") return;

  try {
    await navigator.clipboard.writeText(upiId);

    copyBtn.textContent = "Copied ✓";

    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1500);
  } catch {
    const textarea = document.createElement("textarea");

    textarea.value = upiId;

    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();

    copyBtn.textContent = "Copied ✓";

    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1500);
  }
});

scanAgain.addEventListener("click", () => {
  fileInput.value = "";

  resultBox.classList.add("hidden");
  errorBox.classList.add("hidden");
  statusBox.classList.add("hidden");

  dropZone.classList.remove("hidden");
});

/* =========================================================
   MAIN PROCESS
========================================================= */

async function processFile(file) {
  resultBox.classList.add("hidden");
  errorBox.classList.add("hidden");
  dropZone.classList.add("hidden");

  statusBox.classList.remove("hidden");
  statusBox.textContent = "Preparing image...";

  try {
    const image = await loadImage(file);

    statusBox.textContent = "Looking for QR code...";

    const qrData = await smartDecode(image);

    if (!qrData) {
      throw new Error(
        "QR code could not be read. Try a clearer photo, reduce glare, or move closer to the QR.",
      );
    }

    console.log("Decoded QR:", qrData);

    parseUPI(qrData);
  } catch (error) {
    console.error(error);

    dropZone.classList.remove("hidden");
    statusBox.classList.add("hidden");

    errorBox.textContent = error.message || "Could not decode this QR code.";

    errorBox.classList.remove("hidden");
  }
}

/* =========================================================
   SMART QR DECODER
========================================================= */

async function smartDecode(image) {
  /*
       We don't just scan the original image.

       We create multiple candidate images:

       1. Original
       2. Enlarged
       3. Center crop
       4. Large center crop
       5. Top / bottom / left / right crops
       6. Grayscale
       7. High contrast
       8. Sharpened
       9. Inverted
       10. Rotated versions

       This makes the decoder much more tolerant of
       real-world QR photographs.
    */

  const candidates = createCandidates(image);

  console.log(`Trying ${candidates.length} QR candidates...`);

  for (let i = 0; i < candidates.length; i++) {
    statusBox.textContent = `Scanning QR... ${i + 1}/${candidates.length}`;

    const candidate = candidates[i];

    // First try ZXing
    const zxingResult = await decodeWithZXing(candidate);

    if (zxingResult) {
      console.log("QR decoded using ZXing");
      return zxingResult;
    }

    // Then try jsQR
    const jsqrResult = decodeWithJSQR(candidate);

    if (jsqrResult) {
      console.log("QR decoded using jsQR");
      return jsqrResult;
    }

    // Give browser a tiny break between heavy image operations
    await sleep(10);
  }

  return null;
}

/* =========================================================
   CREATE MANY IMAGE CANDIDATES
========================================================= */

function createCandidates(image) {
  const candidates = [];

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  // 1. Original
  candidates.push({
    name: "original",
    canvas: imageToCanvas(image),
  });

  // 2. Enlarged full image
  candidates.push({
    name: "large",
    canvas: imageToCanvas(image, 1.5),
  });

  // 3. Center 85%
  candidates.push({
    name: "center-85",
    canvas: cropCanvas(
      image,
      width * 0.075,
      height * 0.075,
      width * 0.85,
      height * 0.85,
    ),
  });

  // 4. Center 70%
  candidates.push({
    name: "center-70",
    canvas: cropCanvas(
      image,
      width * 0.15,
      height * 0.15,
      width * 0.7,
      height * 0.7,
    ),
  });

  // 5. Middle wide region
  candidates.push({
    name: "middle",
    canvas: cropCanvas(image, 0, height * 0.15, width, height * 0.7),
  });

  // 6. Top half
  candidates.push({
    name: "top",
    canvas: cropCanvas(image, 0, 0, width, height * 0.6),
  });

  // 7. Bottom half
  candidates.push({
    name: "bottom",
    canvas: cropCanvas(image, 0, height * 0.4, width, height * 0.6),
  });

  // 8. Left half
  candidates.push({
    name: "left",
    canvas: cropCanvas(image, 0, 0, width * 0.6, height),
  });

  // 9. Right half
  candidates.push({
    name: "right",
    canvas: cropCanvas(image, width * 0.4, 0, width * 0.6, height),
  });

  /*
       Add processed versions of the most important regions.
    */

  const baseCandidates = [
    candidates[0],
    candidates[1],
    candidates[2],
    candidates[3],
  ];

  for (const candidate of baseCandidates) {
    candidates.push({
      name: `${candidate.name}-gray`,
      canvas: grayscaleCanvas(candidate.canvas),
    });

    candidates.push({
      name: `${candidate.name}-contrast`,
      canvas: contrastCanvas(candidate.canvas),
    });

    candidates.push({
      name: `${candidate.name}-sharp`,
      canvas: sharpenCanvas(candidate.canvas),
    });

    candidates.push({
      name: `${candidate.name}-invert`,
      canvas: invertCanvas(candidate.canvas),
    });
  }

  return candidates;
}

/* =========================================================
   ZXING
========================================================= */

async function decodeWithZXing(candidate) {
  try {
    if (typeof ZXingBrowser === "undefined") {
      console.log("ZXing not loaded");
      return null;
    }

    if (!zxingReader) {
      zxingReader = new ZXingBrowser.BrowserQRCodeReader();
    }

    const image = await canvasToImage(candidate.canvas);

    const result = await zxingReader.decodeFromImageElement(image);

    if (result) {
      return result.getText();
    }
  } catch (error) {
    // Expected when a candidate doesn't contain a QR.
    console.log(`ZXing failed on ${candidate.name}`);
  }

  return null;
}

/* =========================================================
   JSQR
========================================================= */

function decodeWithJSQR(candidate) {
  try {
    if (typeof jsQR === "undefined") {
      return null;
    }

    const canvas = candidate.canvas;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    if (result) {
      return result.data;
    }
  } catch (error) {
    console.log(`jsQR failed on ${candidate.name}`);
  }

  return null;
}

/* =========================================================
   IMAGE → CANVAS
========================================================= */

function imageToCanvas(image, scale = 1) {
  const maxSize = 2400;

  let width = image.naturalWidth * scale;
  let height = image.naturalHeight * scale;

  const largest = Math.max(width, height);

  if (largest > maxSize) {
    const ratio = maxSize / largest;

    width *= ratio;
    height *= ratio;
  }

  const canvas = document.createElement("canvas");

  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

/* =========================================================
   CROP
========================================================= */

function cropCanvas(image, x, y, width, height) {
  const maxSize = 2400;

  const scale = Math.min(1, maxSize / Math.max(width, height));

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(width * scale));

  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);

  return canvas;
}

/* =========================================================
   GRAYSCALE
========================================================= */

function grayscaleCanvas(source) {
  const canvas = cloneCanvas(source);

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/* =========================================================
   CONTRAST
========================================================= */

function contrastCanvas(source) {
  const canvas = cloneCanvas(source);

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const data = imageData.data;

  const factor = 1.7;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor * (data[i] - 128) + 128);

    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);

    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/* =========================================================
   SHARPEN
========================================================= */

function sharpenCanvas(source) {
  const canvas = cloneCanvas(source);

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const src = imageData.data;

  const output = new Uint8ClampedArray(src);

  const width = canvas.width;
  const height = canvas.height;

  /*
       Simple sharpening kernel:

       0  -1   0
      -1   5  -1
       0  -1   0
    */

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel++) {
        const value =
          5 * src[index + channel] -
          src[index - 4 + channel] -
          src[index + 4 + channel] -
          src[index - width * 4 + channel] -
          src[index + width * 4 + channel];

        output[index + channel] = clamp(value);
      }
    }
  }

  imageData.data.set(output);

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/* =========================================================
   INVERT
========================================================= */

function invertCanvas(source) {
  const canvas = cloneCanvas(source);

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/* =========================================================
   CLONE CANVAS
========================================================= */

function cloneCanvas(source) {
  const canvas = document.createElement("canvas");

  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  ctx.drawImage(source, 0, 0);

  return canvas;
}

/* =========================================================
   CANVAS → IMAGE
========================================================= */

function canvasToImage(canvas) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;

    image.src = canvas.toDataURL("image/png");
  });
}

/* =========================================================
   LOAD UPLOADED IMAGE
========================================================= */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);

    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);

      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);

      reject(new Error("Could not open image."));
    };

    image.src = url;
  });
}

/* =========================================================
   UPI PARSER
========================================================= */

function parseUPI(data) {
  const text = data.trim();

  if (!/^upi:\/\/pay(?:\?|$)/i.test(text)) {
    throw new Error(
      "QR was decoded, but it is not a supported UPI payment QR.",
    );
  }

  let url;

  try {
    url = new URL(text);
  } catch {
    throw new Error("The UPI payment data is invalid.");
  }

  const params = new URLSearchParams(url.search);

  const upiId = params.get("pa");

  if (!upiId) {
    throw new Error("This UPI QR does not contain a UPI ID.");
  }

  const validUPI = /^[^\s@]+@[^\s@]+$/;

  if (!validUPI.test(upiId)) {
    throw new Error("The extracted UPI ID does not have a valid format.");
  }

  upiIdEl.textContent = upiId;

  const details = [
    ["Payee name", params.get("pn")],

    ["Amount", formatAmount(params.get("am"), params.get("cu"))],

    ["Currency", params.get("cu")],

    ["Note", params.get("tn")],

    ["Reference", params.get("tr")],

    ["Mode", params.get("mode")],
  ];

  detailsEl.innerHTML = details
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `
                <div class="detail">
                    <span class="label">
                        ${escapeHTML(label)}
                    </span>

                    <strong>
                        ${escapeHTML(value)}
                    </strong>
                </div>
            `,
    )
    .join("");

  statusBox.classList.add("hidden");

  resultBox.classList.remove("hidden");
}

/* =========================================================
   HELPERS
========================================================= */

function formatAmount(amount, currency) {
  if (!amount) return "";

  if (currency?.toUpperCase() === "INR") {
    return `₹${amount}`;
  }

  return `${amount} ${currency || ""}`.trim();
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* =========================================================
   CAMERA SCANNER
========================================================= */

cameraBtn.addEventListener("click", startCamera);

closeCamera.addEventListener("click", stopCamera);

async function startCamera() {
  try {
    // Hide upload UI
    dropZone.classList.add("hidden");

    // Hide previous results/errors
    resultBox.classList.add("hidden");
    errorBox.classList.add("hidden");
    statusBox.classList.add("hidden");

    cameraPanel.classList.remove("hidden");

    cameraStatus.textContent = "Requesting camera permission...";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera access is not supported by this browser.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment",
        },

        width: {
          ideal: 1280,
        },

        height: {
          ideal: 720,
        },
      },

      audio: false,
    });

    cameraVideo.srcObject = cameraStream;

    await cameraVideo.play();

    cameraStatus.textContent = "Point your camera at a UPI QR";

    cameraScanning = true;

    scanCameraFrame();
  } catch (error) {
    console.error(error);

    stopCamera();

    errorBox.textContent =
      error.name === "NotAllowedError"
        ? "Camera permission was denied. Please allow camera access and try again."
        : error.message || "Could not access the camera.";

    errorBox.classList.remove("hidden");
  }
}

function stopCamera() {
  cameraScanning = false;

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());

    cameraStream = null;
  }

  cameraVideo.srcObject = null;

  cameraPanel.classList.add("hidden");

  dropZone.classList.remove("hidden");
}

/* =========================================================
   CONTINUOUS CAMERA SCANNING
========================================================= */

async function scanCameraFrame() {
  if (!cameraScanning) {
    return;
  }

  if (cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(scanCameraFrame);

    return;
  }

  try {
    const canvas = document.createElement("canvas");

    const width = cameraVideo.videoWidth;

    const height = cameraVideo.videoHeight;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    ctx.drawImage(cameraVideo, 0, 0, width, height);

    /*
           First try jsQR because it works directly
           with camera frame pixel data.
        */

    const imageData = ctx.getImageData(0, 0, width, height);

    const result = jsQR(imageData.data, width, height, {
      inversionAttempts: "attemptBoth",
    });

    if (result) {
      console.log("Camera QR detected:", result.data);

      handleCameraResult(result.data);

      return;
    }
  } catch (error) {
    console.log("Camera frame decode failed:", error);
  }

  requestAnimationFrame(scanCameraFrame);
}

/* =========================================================
   CAMERA RESULT
========================================================= */

function handleCameraResult(data) {
  cameraScanning = false;

  stopCamera();

  try {
    parseUPI(data);
  } catch (error) {
    errorBox.textContent =
      error.message || "This QR could not be used as a UPI payment QR.";

    errorBox.classList.remove("hidden");
  }
}
