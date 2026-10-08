const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const errorBox = document.getElementById("error");
const upiIdEl = document.getElementById("upiId");
const detailsEl = document.getElementById("details");
const copyBtn = document.getElementById("copyBtn");
const scanAgain = document.getElementById("scanAgain");
const payBtn = document.getElementById("payBtn");

let zxingReader = null;

/*
  Updated Schemes:
  Ab ye schemes sirf app open karenge bina kisi payment data ke.
*/
const UPI_APPS = [
  {
    name: "Google Pay",
    scheme: "tez://", // Opens GPay app directly
    iconSvg: `
      <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="19" fill="#ffffff" stroke="#e4e7ec"/>
        <path d="M20 20 L20 2 A18 18 0 0 1 38 20 Z" fill="#4285F4"/>
        <path d="M20 20 L38 20 A18 18 0 0 1 20 38 Z" fill="#34A853"/>
        <path d="M20 20 L20 38 A18 18 0 0 1 2 20 Z" fill="#FBBC05"/>
        <path d="M20 20 L2 20 A18 18 0 0 1 20 2 Z" fill="#EA4335"/>
      </svg>
    `,
  },
  {
    name: "PhonePe",
    scheme: "phonepe://", // Opens PhonePe app directly
    iconSvg: `
      <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#5F259F"/>
        <text x="20" y="27" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">P</text>
      </svg>
    `,
  },
  {
    name: "Paytm",
    scheme: "paytmmp://", // Opens Paytm app directly
    iconSvg: `
      <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#00BAF2"/>
        <text x="20" y="27" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#ffffff" text-anchor="middle">₹</text>
      </svg>
    `,
  },
  {
    name: "BHIM",
    scheme: "bhim://", // Opens BHIM app directly
    iconSvg: `
      <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#ffffff" stroke="#e4e7ec"/>
        <rect y="6" width="40" height="9" fill="#FF9933"/>
        <rect y="15" width="40" height="9" fill="#ffffff"/>
        <rect y="24" width="40" height="9" fill="#138808"/>
        <text x="20" y="26" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#0b3d91" text-anchor="middle">B</text>
      </svg>
    `,
  },
];

let scanToken = 0;

if (statusBox) {
  statusBox.setAttribute("aria-live", "polite");
  statusBox.setAttribute("role", "status");
}

/* =========================================================
   FILE INPUT & DRAG & DROP
========================================================= */

if (fileInput) {
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  });
}

if (dropZone) {
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
}

/* =========================================================
   PAY NOW — APP CHOOSER
========================================================= */

const appChooserModal = document.getElementById("appChooserModal");
const appChooserList = document.getElementById("appChooserList");
const appChooserClose = document.getElementById("appChooserClose");
const appChooserStatus = document.getElementById("appChooserStatus");
const appChooserMore = document.getElementById("appChooserMore");

function openAppChooser() {
  if (!appChooserModal) return;

  if (appChooserStatus) {
    appChooserStatus.classList.add("hidden");
    appChooserStatus.textContent = "";
  }

  // Reminder for user to copy the ID first
  if (appChooserStatus) {
    appChooserStatus.classList.remove("hidden");
    appChooserStatus.textContent =
      "Please make sure you copied the UPI ID first!";
  }

  appChooserModal.classList.remove("hidden");
}

function closeAppChooser() {
  if (appChooserModal) {
    appChooserModal.classList.add("hidden");
  }
}

if (payBtn) payBtn.addEventListener("click", openAppChooser);
if (appChooserClose) appChooserClose.addEventListener("click", closeAppChooser);

if (appChooserModal) {
  appChooserModal.addEventListener("click", (e) => {
    if (e.target === appChooserModal) closeAppChooser();
  });
}

// "More UPI apps" now just tries to open the generic UPI picker without params
if (appChooserMore) {
  appChooserMore.addEventListener("click", () => {
    window.location.href = "upi://";
  });
}

function renderAppChooserButtons() {
  if (!appChooserList) return;
  appChooserList.innerHTML = "";

  UPI_APPS.forEach((app) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "app-choice";
    btn.innerHTML = `
      <span class="app-choice-icon">${app.iconSvg}</span>
      <span>${escapeHTML(app.name)}</span>
    `;
    btn.addEventListener("click", () => tryOpenApp(app));
    appChooserList.appendChild(btn);
  });
}

renderAppChooserButtons();

function tryOpenApp(app) {
  const deepLink = app.scheme;

  let appOpened = false;

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      appOpened = true;
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);

  if (appChooserStatus) {
    appChooserStatus.classList.remove("hidden");
    appChooserStatus.textContent = `Opening ${app.name}... Paste the UPI ID there.`;
  }

  window.location.href = deepLink;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);

    // Modified message to handle iOS prompt behavior gracefully
    if (!appOpened && appChooserStatus) {
      appChooserStatus.textContent = `If ${app.name} didn't open or prompt you, it might not be installed.`;
    }
  }, 1500);
}

/* =========================================================
   COPY UPI ID (Fixed with Synchronous Fallback)
========================================================= */

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const upiId = upiIdEl.textContent.trim();
    if (!upiId || upiId === "—") return;

    const showSuccess = () => {
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1500);
    };

    // 1. Try modern clipboard API if available and secure context
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(upiId);
        showSuccess();
        return;
      } catch (err) {
        console.warn("Clipboard API failed, trying fallback.");
      }
    }

    // 2. Synchronous fallback (Executes immediately if Clipboard API fails/is absent)
    try {
      const textarea = document.createElement("textarea");
      textarea.value = upiId;
      textarea.style.position = "fixed"; // Prevents jumping
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);

      textarea.select();
      document.execCommand("copy");
      textarea.remove();

      showSuccess();
    } catch (err) {
      console.error("Copy failed", err);
      alert(
        "Could not copy automatically. Please select and copy the text manually.",
      );
    }
  });
}

/* =========================================================
   SCAN AGAIN
========================================================= */

if (scanAgain) {
  scanAgain.addEventListener("click", () => {
    scanToken++;

    if (fileInput) fileInput.value = "";

    closeAppChooser();

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.classList.add("disabled");
    }

    if (resultBox) resultBox.classList.add("hidden");
    if (errorBox) errorBox.classList.add("hidden");
    if (statusBox) statusBox.classList.add("hidden");
    if (dropZone) dropZone.classList.remove("hidden");
  });
}

/* =========================================================
   MAIN PROCESS
========================================================= */

async function processFile(file) {
  if (file.type && !file.type.startsWith("image/")) {
    if (dropZone) dropZone.classList.remove("hidden");
    if (errorBox) {
      errorBox.textContent =
        "That doesn't look like an image file. Please upload a photo or screenshot of the QR code.";
      errorBox.classList.remove("hidden");
    }
    return;
  }

  const myToken = ++scanToken;

  if (resultBox) resultBox.classList.add("hidden");
  if (errorBox) errorBox.classList.add("hidden");
  if (dropZone) dropZone.classList.add("hidden");

  if (statusBox) {
    statusBox.classList.remove("hidden");
    statusBox.textContent = "Preparing image...";
  }

  try {
    const image = await loadImage(file);
    if (myToken !== scanToken) return;

    if (statusBox) statusBox.textContent = "Looking for QR code...";

    const qrData = await smartDecode(image, myToken);
    if (myToken !== scanToken) return;

    if (!qrData) {
      throw new Error(
        "QR code could not be read. Try a clearer photo, reduce glare, or move closer to the QR.",
      );
    }

    console.log("Decoded QR:", qrData);
    parseUPI(qrData);
  } catch (error) {
    if (myToken !== scanToken) return;

    console.error(error);

    if (dropZone) dropZone.classList.remove("hidden");
    if (statusBox) statusBox.classList.add("hidden");
    if (errorBox) {
      errorBox.textContent = error.message || "Could not decode this QR code.";
      errorBox.classList.remove("hidden");
    }
  }
}

/* =========================================================
   SMART QR DECODER & CANDIDATES
========================================================= */

async function smartDecode(image, myToken) {
  const quickCandidates = createQuickCandidates(image);
  const quickResult = await tryCandidates(quickCandidates, myToken);

  if (quickResult) return quickResult;
  if (myToken !== scanToken) return null;

  if (statusBox) statusBox.textContent = "Trying harder — enhancing image...";

  // Pass the already-rendered original canvas to save memory
  const fullCandidates = createFullCandidates(image, quickCandidates[0].canvas);
  return tryCandidates(fullCandidates, myToken, quickCandidates.length);
}

async function tryCandidates(candidates, myToken, offset = 0) {
  for (let i = 0; i < candidates.length; i++) {
    if (myToken !== scanToken) return null;

    if (statusBox) statusBox.textContent = `Scanning QR... ${offset + i + 1}`;
    const candidate = candidates[i];

    const jsqrResult = decodeWithJSQR(candidate);
    if (jsqrResult) {
      console.log(`QR decoded using jsQR on ${candidate.name}`);
      return jsqrResult;
    }

    const zxingResult = await decodeWithZXing(candidate);
    if (zxingResult) {
      console.log(`QR decoded using ZXing on ${candidate.name}`);
      return zxingResult;
    }

    await sleep(0);
  }
  return null;
}

function createQuickCandidates(image) {
  return [
    { name: "original", canvas: imageToCanvas(image) },
    { name: "large", canvas: imageToCanvas(image, 1.5) },
  ];
}

function createFullCandidates(image, originalCanvas) {
  const candidates = [];
  const width = image.naturalWidth ?? image.width;
  const height = image.naturalHeight ?? image.height;

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

  candidates.push({
    name: "middle",
    canvas: cropCanvas(image, 0, height * 0.15, width, height * 0.7),
  });

  candidates.push({
    name: "top",
    canvas: cropCanvas(image, 0, 0, width, height * 0.6),
  });
  candidates.push({
    name: "bottom",
    canvas: cropCanvas(image, 0, height * 0.4, width, height * 0.6),
  });
  candidates.push({
    name: "left",
    canvas: cropCanvas(image, 0, 0, width * 0.6, height),
  });
  candidates.push({
    name: "right",
    canvas: cropCanvas(image, width * 0.4, 0, width * 0.6, height),
  });

  const baseCandidates = [
    { name: "original", canvas: originalCanvas },
    candidates[0], // center-85
    candidates[1], // center-70
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
   ZXING & JSQR
========================================================= */

async function decodeWithZXing(candidate) {
  try {
    if (typeof ZXingBrowser === "undefined") return null;
    if (!zxingReader) zxingReader = new ZXingBrowser.BrowserQRCodeReader();

    const image = await canvasToImage(candidate.canvas);
    const result = await zxingReader.decodeFromImageElement(image);
    if (result) return result.getText();
  } catch (error) {}
  return null;
}

function decodeWithJSQR(candidate) {
  try {
    if (typeof jsQR === "undefined") return null;

    const canvas = candidate.canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    if (result) return result.data;
  } catch (error) {
    console.log(`jsQR failed on ${candidate.name}`);
  }
  return null;
}

/* =========================================================
   IMAGE MANIPULATION HELPERS
========================================================= */

function imageToCanvas(image, scale = 1) {
  const maxSize = 2400;
  const naturalWidth = image.naturalWidth ?? image.width;
  const naturalHeight = image.naturalHeight ?? image.height;

  let width = naturalWidth * scale;
  let height = naturalHeight * scale;

  const largest = Math.max(width, height);
  if (largest > maxSize) {
    const ratio = maxSize / largest;
    width *= ratio;
    height *= ratio;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function cropCanvas(image, x, y, width, height) {
  const maxSize = 2400;
  const scale = Math.min(1, maxSize / Math.max(width, height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function grayscaleCanvas(source) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

function contrastCanvas(source) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

function sharpenCanvas(source) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const src = imageData.data;
  const output = new Uint8ClampedArray(src);
  const width = canvas.width;
  const height = canvas.height;

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

function invertCanvas(source) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

function cloneCanvas(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function canvasToImage(canvas) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = canvas.toDataURL("image/png");
  });
}

async function loadImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return bitmap;
    } catch (error) {
      console.log("createImageBitmap failed, falling back to Image()", error);
    }
  }

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
   UPI PARSER (Updated logic just for UI display)
========================================================= */

function parseUPI(data) {
  const text = data.trim();

  const isStandardUPI = /^upi:\/\/pay(?:\?|$)/i.test(text);
  const isTezUPI = /^tez:\/\/upi\/pay(?:\?|$)/i.test(text);

  if (!isStandardUPI && !isTezUPI) {
    throw new Error(
      "QR was decoded, but it is not a supported UPI payment QR.",
    );
  }

  let url;
  try {
    const normalized = isTezUPI
      ? text.replace(/^tez:\/\/upi\/pay/i, "upi://pay")
      : text;
    url = new URL(normalized);
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

  // Display UPI ID
  if (upiIdEl) upiIdEl.textContent = upiId;

  // Enable Pay Now Button
  if (payBtn) {
    payBtn.disabled = false;
    payBtn.classList.remove("disabled");
  }

  // Display Details
  const details = [
    ["Payee name", params.get("pn")],
    ["Amount", formatAmount(params.get("am"), params.get("cu"))],
    ["Currency", params.get("cu")],
    ["Note", params.get("tn")],
    ["Reference", params.get("tr")],
    ["Mode", params.get("mode")],
  ];

  if (detailsEl) {
    detailsEl.innerHTML = details
      .filter(([, value]) => value)
      .map(
        ([label, value]) => `
          <div class="detail">
            <span class="label">${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `,
      )
      .join("");
  }

  if (statusBox) statusBox.classList.add("hidden");
  if (resultBox) resultBox.classList.remove("hidden");
}

/* =========================================================
   HELPERS
========================================================= */

function formatAmount(amount, currency) {
  if (!amount) return "";
  if (currency?.toUpperCase() === "INR") return `₹${amount}`;
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
