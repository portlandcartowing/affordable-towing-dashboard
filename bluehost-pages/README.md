# Bluehost-hosted assets for portlandcartowing.com

Static files that live at `portlandcartowing.com/...` on the Bluehost server. The canonical source is in this repo; Bluehost is the deploy target.

## Files

| File | Purpose | Where it goes |
|---|---|---|
| `privacy.html` | Privacy policy page | `/home1/ehqxubmy/public_html/privacy.html` |
| `terms.html` | Terms of service | `/home1/ehqxubmy/public_html/terms.html` |
| `pct-tracker.js` | DNI + click tracking + Google Ads conversion | `/home1/ehqxubmy/public_html/pct-tracker.js` |

## Installing the tracker

### Step 1 — Upload `pct-tracker.js` to Bluehost

Place it at `public_html/pct-tracker.js` so it is accessible at:
`https://portlandcartowing.com/pct-tracker.js`

### Step 2 — Add the header snippet to every page

Paste this inside the `<head>` of every page on the website — typically in the theme's `header.php`, or (on a static site) the shared header include. Replace `AW-XXXXXXXXX` with your actual Google Ads conversion ID once you create the conversion action.

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXX');
</script>

<!-- Portland Car Towing attribution + DNI -->
<script src="https://portlandcartowing.com/pct-tracker.js" defer></script>
```

### Step 3 — Configure the tracker

Open `pct-tracker.js` and update the `CFG` block at the top:

```js
googleAdsId: "AW-XXXXXXXXX",         // your actual conversion ID
phoneClickLabel: "REPLACE_WITH_LABEL" // the conversion label from Google Ads
```

You get both values from Google Ads → Tools → Conversions → "Phone call from website" action → Tag setup → "Use Google Tag Manager" or "Install the tag yourself" → look for `send_to: 'AW-XXXXXXXXX/ABCdefGHIjkl'`. The part before the slash is the ID, after is the label.

### Step 4 — Ensure all phone numbers on the site are in the right format

The tracker automatically swaps:

- Every `<a href="tel:+1XXXXXXXXXX">` — both the `href` and the visible text
- Every element with `data-pct-phone` attribute

If a phone number is shown as plain text with NO `tel:` link and NO `data-pct-phone` attribute, it will NOT be swapped. Either wrap it in `<a href="tel:...">` (preferred — clickable anyway) or add `data-pct-phone`.

Examples that work:
```html
<a href="tel:+15036087014">(503) 608-7014</a>
<span data-pct-phone>(503) 608-7014</span>
```

Examples that do NOT get swapped:
```html
Call us at 503-608-7014
```

## How attribution works end-to-end

1. Visitor lands on portlandcartowing.com with `?gclid=abc123&utm_source=google&utm_medium=cpc`
2. `pct-tracker.js` detects paid traffic → swaps displayed number to `+15034066323` (Ads tracking number)
3. Visitor taps the number
4. `sendBeacon` fires a POST to `/api/track/click` with gclid, utm params, landing page URL
5. Visitor's phone dials `+15034066323`
6. Twilio POSTs to `/api/twilio/voice`
7. The voice webhook matches the call to the recent click_event (within 5 min, same tracking number)
8. The `calls` row gets enriched with campaign, adgroup, keyword
9. Twilio forwards the call to `+15033888741` (owner cell)
10. Dashboard shows: "Call from +1503XXX — Google Ads — campaign 'emergency-tow' — keyword 'tow truck near me'"

For organic/direct traffic, the same flow applies but with different tracking number and no ad-level fields.

## Testing

After deploying:

1. Open portlandcartowing.com in an incognito window
2. Append `?utm_source=google&utm_medium=cpc&gclid=test123` to the URL
3. Confirm the displayed phone number changed to `(503) 406-6323`
4. Open DevTools → Network tab, filter to "click"
5. Click the phone number — you should see a POST to `/api/track/click` with status 200
6. In the Supabase `click_events` table, confirm the row exists with `utm_source=google` and `gclid=test123`

Repeat for organic (clear cookies, set referrer to google.com manually) and direct (no URL params, no referrer).
