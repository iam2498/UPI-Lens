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
let currentUPIPaymentUrl = "";
let currentUPIQueryString = "";

/*
  Common UPI apps and their own custom URI schemes.

  Android is supposed to show an app picker for a generic
  "upi://pay" link, but if the user ever tapped "Always" on
  one app (WhatsApp Pay, most commonly), Android silently
  skips the picker forever afterwards and always opens that
  app instead. Targeting each app's own scheme directly
  sidesteps that broken OS default entirely.

  These schemes are community-documented, not officially
  published by each company, so they can change. Test on a
  real device; if one stops working, it can simply be removed
  or updated here.
*/
const UPI_APPS = [
  {
    name: "Google Pay",
    scheme: "tez://upi/pay",
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
    scheme: "phonepe://pay",
    iconSvg: `
      <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#5F259F"/>
        <text x="20" y="27" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">P</text>
      </svg>
    `,
  },
  {
    name: "Paytm",
    scheme: "paytmmp://pay",
    iconSvg: `
      <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#00BAF2"/>
        <text x="20" y="27" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#ffffff" text-anchor="middle">₹</text>
      </svg>
    `,
  },
  {
    name: "BHIM",
    scheme: "bhim://pay",
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

/*
  Bump this on every new scan. Any in-flight async work checks
  its own captured token against the live one before touching
  the DOM, so a fast re-scan can never be overwritten by a
  slower, stale scan that finishes later.
*/
let scanToken = 0;

/* Make status updates audible to screen readers */
if (statusBox) {
  statusBox.setAttribute("aria-live", "polite");
  statusBox.setAttribute("role", "status");
}

/* =========================================================
   FILE INPUT
========================================================= */

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];

  if (file) {
    processFile(file);
  }
});

/* =========================================================
   DRAG & DROP
========================================================= */

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

  if (file) {
    processFile(file);
  }
});

/* =========================================================
   PAY NOW — APP CHOOSER
========================================================= */

const appChooserModal = document.getElementById("appChooserModal");
const appChooserList = document.getElementById("appChooserList");
const appChooserClose = document.getElementById("appChooserClose");
const appChooserStatus = document.getElementById("appChooserStatus");
const appChooserMore = document.getElementById("appChooserMore");

function openAppChooser() {
  if (!currentUPIQueryString || !appChooserModal) {
    return;
  }

  if (appChooserStatus) {
    appChooserStatus.classList.add("hidden");
    appChooserStatus.textContent = "";
  }

  appChooserModal.classList.remove("hidden");
}

function closeAppChooser() {
  if (appChooserModal) {
    appChooserModal.classList.add("hidden");
  }
}

if (payBtn) {
  payBtn.addEventListener("click", openAppChooser);
}

if (appChooserClose) {
  appChooserClose.addEventListener("click", closeAppChooser);
}

/* Click on the dimmed backdrop closes the sheet */
if (appChooserModal) {
  appChooserModal.addEventListener("click", (e) => {
    if (e.target === appChooserModal) {
      closeAppChooser();
    }
  });
}

/*
  "More UPI apps" falls back to the generic upi://pay link,
  which either shows the OS's own picker (if no default is
  set) or opens whatever app the OS currently defaults to.
*/
if (appChooserMore) {
  appChooserMore.addEventListener("click", () => {
    if (currentUPIPaymentUrl) {
      window.location.href = currentUPIPaymentUrl;
    }
  });
}

function renderAppChooserButtons() {
  if (!appChooserList) {
    return;
  }

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
  if (!currentUPIQueryString) {
    return;
  }

  const deepLink = `${app.scheme}?${currentUPIQueryString}`;

  /*
    If the deep link actually opens an installed app, the
    browser tab backgrounds (visibilitychange fires "hidden").
    If nothing happens within ~1.5s and the tab is still
    visible, the app almost certainly isn't installed — show
    a hint instead of silently doing nothing.
  */

  let appOpened = false;

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      appOpened = true;
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);

  if (appChooserStatus) {
    appChooserStatus.classList.remove("hidden");
    appChooserStatus.textContent = `Opening ${app.name}...`;
  }

  window.location.href = deepLink;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);

    if (!appOpened && appChooserStatus) {
      appChooserStatus.textContent = `${app.name} doesn't seem to be installed. Try another app, or "More UPI apps" below.`;
    }
  }, 1500);
}

/* =========================================================
   COPY UPI ID
========================================================= */

copyBtn.addEventListener("click", async () => {
  const upiId = upiIdEl.textContent.trim();

  if (!upiId || upiId === "—") {
    return;
  }

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

/* =========================================================
   SCAN AGAIN
========================================================= */

scanAgain.addEventListener("click", () => {
  /* Invalidate any scan still running in the background */
  scanToken++;

  fileInput.value = "";

  currentUPIPaymentUrl = "";
  currentUPIQueryString = "";

  closeAppChooser();

  if (payBtn) {
    payBtn.disabled = true;
    payBtn.classList.add("disabled");
  }

  resultBox.classList.add("hidden");
  errorBox.classList.add("hidden");
  statusBox.classList.add("hidden");

  dropZone.classList.remove("hidden");
});

/* =========================================================
   MAIN PROCESS
========================================================= */

async function processFile(file) {
  /* Reject non-image files early with a clean error */
  if (file.type && !file.type.startsWith("image/")) {
    dropZone.classList.remove("hidden");
    errorBox.textContent =
      "That doesn't look like an image file. Please upload a photo or screenshot of the QR code.";
    errorBox.classList.remove("hidden");
    return;
  }

  /* This scan's identity. Any DOM write below first checks
     this still matches the live scanToken. */
  const myToken = ++scanToken;

  resultBox.classList.add("hidden");
  errorBox.classList.add("hidden");
  dropZone.classList.add("hidden");

  statusBox.classList.remove("hidden");
  statusBox.textContent = "Preparing image...";

  try {
    const image = await loadImage(file);

    if (myToken !== scanToken) return; // superseded by a newer scan

    statusBox.textContent = "Looking for QR code...";

    const qrData = await smartDecode(image, myToken);

    if (myToken !== scanToken) return; // superseded

    if (!qrData) {
      throw new Error(
        "QR code could not be read. Try a clearer photo, reduce glare, or move closer to the QR.",
      );
    }

    console.log("Decoded QR:", qrData);

    parseUPI(qrData);
  } catch (error) {
    if (myToken !== scanToken) return; // superseded, don't show a stale error

    console.error(error);

    dropZone.classList.remove("hidden");
    statusBox.classList.add("hidden");

    errorBox.textContent = error.message || "Could not decode this QR code.";

    errorBox.classList.remove("hidden");
  }
}

/* =========================================================
   SMART QR DECODER (tiered)
========================================================= */

/*
  Tier 1: the two cheapest, most-likely-to-succeed candidates
  (original + enlarged), decoded with jsQR first since it's
  synchronous and fast, falling back to ZXing only if needed.

  Tier 2: if tier 1 fails on both engines, escalate to the
  full crop/filter cascade for hard cases (glare, tilt, low
  contrast, partial frame, etc).

  This means a clean, well-lit QR photo resolves in 1-4 quick
  attempts instead of always running the full ~25-candidate,
  dual-engine cascade.
*/

async function smartDecode(image, myToken) {
  const quickCandidates = createQuickCandidates(image);

  const quickResult = await tryCandidates(quickCandidates, myToken);

  if (quickResult) {
    return quickResult;
  }

  if (myToken !== scanToken) return null;

  statusBox.textContent = "Trying harder — enhancing image...";

  const fullCandidates = createFullCandidates(image);

  return tryCandidates(fullCandidates, myToken, quickCandidates.length);
}

async function tryCandidates(candidates, myToken, offset = 0) {
  for (let i = 0; i < candidates.length; i++) {
    if (myToken !== scanToken) return null; // abandon stale scan

    statusBox.textContent = `Scanning QR... ${offset + i + 1}`;

    const candidate = candidates[i];

    /* -----------------------------------------------------
       jsQR first: synchronous, cheap, resolves most photos
    ----------------------------------------------------- */

    const jsqrResult = decodeWithJSQR(candidate);

    if (jsqrResult) {
      console.log(`QR decoded using jsQR on ${candidate.name}`);

      return jsqrResult;
    }

    /* -----------------------------------------------------
       ZXing second: slower (async), catches cases jsQR misses
    ----------------------------------------------------- */

    const zxingResult = await decodeWithZXing(candidate);

    if (zxingResult) {
      console.log(`QR decoded using ZXing on ${candidate.name}`);

      return zxingResult;
    }

    /* -----------------------------------------------------
       Give browser a tiny break between heavy operations
    ----------------------------------------------------- */

    await sleep(0);
  }

  return null;
}

/* =========================================================
   QUICK CANDIDATES (tier 1)
========================================================= */

function createQuickCandidates(image) {
  return [
    { name: "original", canvas: imageToCanvas(image) },
    { name: "large", canvas: imageToCanvas(image, 1.5) },
  ];
}

/* =========================================================
   FULL CANDIDATES (tier 2 — the exhaustive cascade)
========================================================= */

function createFullCandidates(image) {
  const candidates = [];

  const width = image.naturalWidth ?? image.width;
  const height = image.naturalHeight ?? image.height;

  /* -------------------------------------------------------
     Center 85%
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Center 70%
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Middle wide region
  ------------------------------------------------------- */

  candidates.push({
    name: "middle",
    canvas: cropCanvas(image, 0, height * 0.15, width, height * 0.7),
  });

  /* -------------------------------------------------------
     Top / Bottom / Left / Right halves
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Filtered variants of the most useful base crops
  ------------------------------------------------------- */

  const baseCandidates = [
    { name: "original", canvas: imageToCanvas(image) },
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
   ZXING
========================================================= */

async function decodeWithZXing(candidate) {
  try {
    if (typeof ZXingBrowser === "undefined") {
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
    /*
      Expected when a candidate doesn't contain a QR.
    */
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
   LOAD UPLOADED IMAGE (EXIF-orientation aware)
========================================================= */

async function loadImage(file) {
  /*
    Phone camera photos often carry EXIF orientation metadata.
    createImageBitmap with imageOrientation: "from-image" applies
    that rotation automatically, so a sideways/upside-down QR
    photo still decodes correctly. Falls back to the classic
    Image() + object URL approach for browsers/files where
    createImageBitmap isn't available or fails.
  */

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });

      return bitmap; // has .width / .height, works with drawImage
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
   UPI PARSER
========================================================= */

function parseUPI(data) {
  const text = data.trim();

  /* -------------------------------------------------------
     Validate UPI URL — accepts both the standard upi://pay
     scheme and the legacy tez://upi/pay scheme still emitted
     by some older/regional UPI apps.
  ------------------------------------------------------- */

  const isStandardUPI = /^upi:\/\/pay(?:\?|$)/i.test(text);
  const isTezUPI = /^tez:\/\/upi\/pay(?:\?|$)/i.test(text);

  if (!isStandardUPI && !isTezUPI) {
    throw new Error(
      "QR was decoded, but it is not a supported UPI payment QR.",
    );
  }

  let url;

  try {
    /* Normalize tez:// to a URL the URL() constructor parses the same way */
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

  /* -------------------------------------------------------
     Validate UPI ID
  ------------------------------------------------------- */

  const validUPI = /^[^\s@]+@[^\s@]+$/;

  if (!validUPI.test(upiId)) {
    throw new Error("The extracted UPI ID does not have a valid format.");
  }

  /* -------------------------------------------------------
     Build UPI Payment Deep Link
  ------------------------------------------------------- */

  const paymentParams = new URLSearchParams();

  /*
    Preserve supported UPI payment parameters.

    pa  = Payee UPI ID
    pn  = Payee name
    mc  = Merchant code
    tid = Transaction ID
    tr  = Transaction reference
    tn  = Transaction note
    am  = Amount
    cu  = Currency
    url = URL
    mode = Mode
    orgid = Organization ID
    sign = Signature
  */

  [
    "pa",
    "pn",
    "mc",
    "tid",
    "tr",
    "tn",
    "am",
    "cu",
    "url",
    "mode",
    "orgid",
    "sign",
  ].forEach((key) => {
    const value = params.get(key);

    if (value) {
      paymentParams.set(key, value);
    }
  });

  currentUPIQueryString = paymentParams.toString();
  currentUPIPaymentUrl = `upi://pay?${currentUPIQueryString}`;

  /* -------------------------------------------------------
     Display UPI ID
  ------------------------------------------------------- */

  upiIdEl.textContent = upiId;

  /* -------------------------------------------------------
     Enable Pay Now
  ------------------------------------------------------- */

  if (payBtn) {
    payBtn.disabled = false;

    payBtn.classList.remove("disabled");
  }

  /* -------------------------------------------------------
     Display Details
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Show Result
  ------------------------------------------------------- */

  statusBox.classList.add("hidden");

  resultBox.classList.remove("hidden");
}

/* =========================================================
   FORMAT AMOUNT
========================================================= */

function formatAmount(amount, currency) {
  if (!amount) {
    return "";
  }

  if (currency?.toUpperCase() === "INR") {
    return `₹${amount}`;
  }

  return `${amount} ${currency || ""}`.trim();
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");
}

/* =========================================================
   CLAMP
========================================================= */

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

/* =========================================================
   SLEEP
========================================================= */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
