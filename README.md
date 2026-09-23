# 🔍 UPI Lens

> **Stuck sending only ₹2,000 from a QR image? Extract the UPI ID instead — and enter the amount you actually want to pay.**

[![Made with ❤️](https://img.shields.io/badge/Made%20with-%E2%9D%A4-red)](#)
[![Status](https://img.shields.io/badge/status-active-brightgreen)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](#-license)

---

## 🎯 The Problem UPI Lens Solves

Someone sends you a QR code. You want to pay **more than ₹2,000.**

For example, someone sends you a payment QR through:

- WhatsApp
- Instagram
- Screenshot
- Gallery
- Photo
- Invoice image

You open the QR image and try to use it for payment.

### The Problem

With the QR/photo payment flow you're using, you may only be able to send **₹2,000 at a time.**

But what if you need to pay:

> **₹5,000? ₹10,000? ₹25,000?**

You need the recipient's **UPI ID** so you can start a normal UPI payment and enter the amount you actually want to send.

> **Note:** The ₹2,000 example refers to the limitation of the particular QR/photo payment flow being used. UPI Lens does not impose, remove, or bypass UPI, bank, or UPI-app transaction limits.

---

## 💡 UPI Lens

**Don't type the UPI ID manually. Simply upload the QR image or scan it directly with your camera using UPI Lens.**

```text
Someone sends QR on WhatsApp
             ↓
      Upload QR Image
             OR
       Scan with Camera
             ↓
          UPI Lens
             ↓
      Decode QR Code
             ↓
      Extract UPI ID
             ↓
        Tap Pay Now
             ↓
   Choose Google Pay / PhonePe /
      Paytm / BHIM (or copy the
        UPI ID manually instead)
             ↓
       Enter your amount
             ↓
      Verify recipient
             ↓
            Pay
```

---

## 📱 Example

Someone sends you this:

```text
📱 WhatsApp

┌───────────────────┐
│                   │
│      PAYMENT      │
│        QR         │
│                   │
│       ▣▣▣         │
│       ▣▣▣         │
│       ▣▣▣         │
│                   │
└───────────────────┘
```

You need to pay **₹5,000.**

Instead of being restricted by the QR/photo payment flow:

```text
QR / Photo
    ↓
₹2,000 at a time
```

**Use UPI Lens:**

```text
QR / Photo
    ↓
UPI Lens
    ↓
7096932498@slc
    ↓
Tap Pay Now
    ↓
Choose Google Pay / PhonePe / Paytm / BHIM
    ↓
Enter ₹5,000
    ↓
Verify recipient
    ↓
Pay
```

---

## 🚀 In One Line

> Someone sends you a payment QR? Upload it to UPI Lens, extract the UPI ID, then tap Pay Now to jump straight into Google Pay, PhonePe, Paytm, or BHIM — or copy the UPI ID and paste it manually if you prefer.

---

## ⚙️ How It Works

| Step | Action                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| 1️⃣   | Upload a QR image (screenshot, photo, or gallery file) or scan it live with your camera                                    |
| 2️⃣   | UPI Lens decodes the QR and extracts the embedded UPI payment string                                                       |
| 3️⃣   | The **UPI ID** (and merchant/payee name, if present) is displayed                                                          |
| 4️⃣   | Tap **Pay Now** and pick Google Pay, PhonePe, Paytm, or BHIM — it opens that app directly with the payee already filled in |
| 5️⃣   | Prefer to switch apps yourself instead? Copy the UPI ID with one tap and paste it wherever you like                        |
| 6️⃣   | Enter your desired amount and confirm the payment                                                                          |

---

## ✨ Features

- 📤 **Upload from anywhere** — gallery, screenshot, WhatsApp/Instagram image, or invoice image
- 📷 **Live camera scan** — point your camera at the QR instead of uploading
- ⚡ **Instant extraction** — decodes the UPI ID in seconds
- 💳 **Pay Now app picker** — tap Pay Now and choose Google Pay, PhonePe, Paytm, or BHIM directly, instead of the OS silently defaulting to whichever app it last remembered
- 📋 **One-tap copy** — no manual typing, no typos, for anyone who'd rather paste the UPI ID themselves
- 💸 **No payment limit** — pay any amount directly through your UPI app
- 🔒 **Privacy-first** — UPI Lens only reads the QR; it never touches your money

---

## 🛑 What UPI Lens Does _NOT_ Do

> **UPI Lens does NOT make the payment.**
> It only extracts the payment information encoded inside the QR.
> The actual payment happens in your UPI application.

---

## 💳 Pay Now — Choose Your App

Tapping **Pay Now** opens a picker with **Google Pay, PhonePe, Paytm, and BHIM**, each launched through that app's own link — so you land in the app you actually want, not whichever one your phone silently defaults to.

> **Why this exists:** Android is supposed to show a chooser when a payment link could open several installed apps, but if you ever tapped "Always" on one of them, Android skips the chooser from then on and always opens that same app — usually not the one you meant to use. Picking the app directly in UPI Lens sidesteps that.

Don't see the app you want in the picker? Tap **More UPI apps** to fall back to the standard link, or just copy the UPI ID and paste it into whichever app you prefer.

---

## ⚠️ Important Safety Note

**Always verify the recipient name and UPI ID in your UPI app before confirming the payment.**

UPI Lens helps you extract information faster — it does not replace your own diligence. Double-check the payee details shown in Google Pay / PhonePe / Paytm before you hit **Pay**.

---

## 🧭 Why UPI Lens?

| Without UPI Lens                         | With UPI Lens                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| ❌ Capped at ₹2,000 via QR/photo pay     | ✅ Pay any amount you need                                              |
| ❌ Manually typing a long UPI ID         | ✅ One-tap copy, zero typos                                             |
| ❌ Switching between apps to decode a QR | ✅ Upload once, get the ID instantly                                    |
| ❌ Phone defaults to the wrong UPI app   | ✅ Pay Now lets you pick Google Pay, PhonePe, Paytm, or BHIM every time |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">Made for the moments when ₹2,000 just isn't enough. 💙</p>
