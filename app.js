const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const errorBox = document.getElementById("error");
const upiIdEl = document.getElementById("upiId");
const detailsEl = document.getElementById("details");
const copyBtn = document.getElementById("copyBtn");
const scanAgain = document.getElementById("scanAgain");

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];

  if (file) {
    processFile(file);
  }
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

  if (file) {
    processFile(file);
  }
});

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

scanAgain.addEventListener("click", () => {
  fileInput.value = "";

  resultBox.classList.add("hidden");

  errorBox.classList.add("hidden");

  dropZone.classList.remove("hidden");
});

async function processFile(file) {
  resultBox.classList.add("hidden");

  errorBox.classList.add("hidden");

  dropZone.classList.add("hidden");

  statusBox.classList.remove("hidden");

  statusBox.textContent = "Scanning QR code...";

  try {
    const image = await loadImage(file);

    let qrData = await decodeWithZXing(image);

    if (!qrData) {
      qrData = decodeWithJSQR(image);
    }

    if (!qrData) {
      throw new Error(
        "QR code could not be decoded. Try a clearer image or screenshot.",
      );
    }

    console.log("QR DATA:", qrData);

    parseUPI(qrData);
  } catch (error) {
    console.error(error);

    dropZone.classList.remove("hidden");

    statusBox.classList.add("hidden");

    errorBox.textContent = error.message || "Could not decode this QR code.";

    errorBox.classList.remove("hidden");
  }
}

async function decodeWithZXing(image) {
  try {
    if (typeof ZXingBrowser === "undefined") {
      console.log("ZXing not loaded");

      return null;
    }

    const reader = new ZXingBrowser.BrowserQRCodeReader();

    const result = await reader.decodeFromImageElement(image);

    if (result) {
      console.log("Decoded using ZXing");

      return result.getText();
    }
  } catch (error) {
    console.log("ZXing failed:", error);
  }

  return null;
}

function decodeWithJSQR(image) {
  try {
    const canvas = document.createElement("canvas");

    const maxSize = 2000;

    const scale = Math.min(
      1,
      maxSize / Math.max(image.naturalWidth, image.naturalHeight),
    );

    canvas.width = image.naturalWidth * scale;

    canvas.height = image.naturalHeight * scale;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    if (result) {
      console.log("Decoded using jsQR");

      return result.data;
    }
  } catch (error) {
    console.log("jsQR failed:", error);
  }

  return null;
}

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

function formatAmount(amount, currency) {
  if (!amount) {
    return "";
  }

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
