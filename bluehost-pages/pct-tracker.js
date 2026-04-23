/*!
 * Portland Car Towing — Attribution + DNI tracker
 *
 * Hosted on portlandcartowing.com. Runs on every page.
 *
 * Responsibilities:
 *   1. Detect traffic source from URL params + referrer + localStorage
 *   2. Swap displayed phone numbers (DNI) to the matching Twilio tracking number
 *   3. Fire a click_event to the dashboard when a visitor taps the number
 *   4. Fire a Google Ads conversion event on phone click (for bidding signals)
 *
 * The voice webhook on the dashboard (/api/twilio/voice) matches inbound
 * calls to the most recent click_event on that tracking number within 5 min,
 * which is how each call gets its landing page / keyword / campaign attribution.
 *
 * The caller always dials a TRACKING number, never the direct forward line.
 * DNI only changes which tracking number is shown — the call still flows
 * through Twilio → dashboard → owner's cell.
 */
(function () {
  "use strict";

  var CFG = {
    // API endpoint that stores the click_event
    clickApi: "https://affordable-towing-dashboard.vercel.app/api/track/click",

    // Google Ads conversion ID (replace AW-XXXXXXXXX after creating the
    // conversion action in Google Ads). Leave as null to skip the tag.
    googleAdsId: "AW-XXXXXXXXX",
    // Conversion label for the "phone click" event. Get this from the
    // conversion action's install snippet in Google Ads.
    phoneClickLabel: "REPLACE_WITH_LABEL",

    // Tracking number → purpose. Reflects the tracking_numbers table.
    numbers: {
      paid:    "+15034066323", // Google Ads
      organic: "+15036087014", // Organic search / GMB / direct website
      direct:  "+15034611991", // Direct / typed / referral
    },

    // How long attribution persists in localStorage (ms).
    // Longer = more cross-session continuity; shorter = fresher.
    attributionTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  // -------------------------------------------------------------------------
  // Attribution detection
  // -------------------------------------------------------------------------

  function parseQuery() {
    var q = {};
    var s = window.location.search.replace(/^\?/, "");
    if (!s) return q;
    s.split("&").forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf("=");
      var k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      var v = decodeURIComponent(eq >= 0 ? pair.slice(eq + 1).replace(/\+/g, " ") : "");
      q[k] = v;
    });
    return q;
  }

  function classifyReferrer(ref) {
    if (!ref) return null;
    try {
      var host = new URL(ref).hostname.toLowerCase();
      if (/(^|\.)google\./.test(host)) return "organic_google";
      if (/(^|\.)bing\.com$/.test(host)) return "organic_bing";
      if (/(^|\.)duckduckgo\.com$/.test(host)) return "organic_duckduckgo";
      if (/(^|\.)yahoo\./.test(host)) return "organic_yahoo";
      if (/(^|\.)yelp\./.test(host)) return "referral_yelp";
      if (/(^|\.)facebook\./.test(host)) return "referral_facebook";
      if (host.indexOf("portlandcartowing.com") >= 0) return null; // internal nav
      return "referral";
    } catch (_) {
      return null;
    }
  }

  function detectAttribution() {
    var q = parseQuery();
    var ref = document.referrer || "";

    // Paid signals (any one of these = paid)
    var hasGclid = !!q.gclid;
    var hasPaidUtm = (q.utm_medium && /^(cpc|ppc|paid|paidsearch|paid_search)$/i.test(q.utm_medium));
    var hasMsclkid = !!q.msclkid; // Bing Ads
    var hasFbclid = !!q.fbclid && q.utm_medium && /^(cpc|ppc|paid)$/i.test(q.utm_medium);
    if (hasGclid || hasPaidUtm || hasMsclkid || hasFbclid) {
      return {
        channel: "paid",
        source: q.utm_source || (hasGclid ? "google_ads" : hasMsclkid ? "bing_ads" : "paid"),
        campaign: q.utm_campaign || null,
        adgroup: q.utm_adgroup || null,
        keyword: q.utm_term || null,
        content: q.utm_content || null,
        gclid: q.gclid || null,
        gbraid: q.gbraid || null,
        wbraid: q.wbraid || null,
        referrer: ref || null,
      };
    }

    // Explicit UTM from non-paid link (email, etc.)
    if (q.utm_source || q.utm_medium) {
      return {
        channel: "other",
        source: q.utm_source || "unknown",
        campaign: q.utm_campaign || null,
        keyword: q.utm_term || null,
        content: q.utm_content || null,
        referrer: ref || null,
      };
    }

    // Referrer-based classification
    var refClass = classifyReferrer(ref);
    if (refClass && refClass.indexOf("organic_") === 0) {
      return { channel: "organic", source: refClass.replace("organic_", ""), referrer: ref };
    }
    if (refClass === "referral" || (refClass || "").indexOf("referral_") === 0) {
      return { channel: "referral", source: (refClass || "referral").replace("referral_", ""), referrer: ref };
    }

    // No signals — typed URL, bookmark, or stripped referrer
    return { channel: "direct", source: "direct", referrer: ref || null };
  }

  function loadStoredAttribution() {
    try {
      var raw = localStorage.getItem("pct_attr");
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts) return null;
      if (Date.now() - obj.ts > CFG.attributionTtlMs) return null;
      return obj.data;
    } catch (_) { return null; }
  }

  function storeAttribution(a) {
    try {
      localStorage.setItem("pct_attr", JSON.stringify({ ts: Date.now(), data: a }));
    } catch (_) { /* quota / private mode */ }
  }

  function getAttribution() {
    var fresh = detectAttribution();
    // First-touch wins — if we already have attribution and this visit has
    // no new signals, keep the old one. If a new paid click comes through,
    // overwrite (paid beats everything for ROI tracking).
    var stored = loadStoredAttribution();
    if (stored && fresh.channel === "direct") return stored;
    if (stored && fresh.channel === "organic" && stored.channel === "paid") return stored;
    storeAttribution(fresh);
    return fresh;
  }

  // -------------------------------------------------------------------------
  // Phone number swap (DNI)
  // -------------------------------------------------------------------------

  function numberForChannel(channel) {
    if (channel === "paid") return CFG.numbers.paid;
    if (channel === "organic" || channel === "other") return CFG.numbers.organic;
    return CFG.numbers.direct;
  }

  function formatDisplay(e164) {
    // +15034066323 → (503) 406-6323
    var m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
    if (!m) return e164;
    return "(" + m[1] + ") " + m[2] + "-" + m[3];
  }

  function swapPhoneNumbers(targetE164) {
    var display = formatDisplay(targetE164);

    // 1. Every <a href="tel:..."> gets both href and text replaced
    var anchors = document.querySelectorAll('a[href^="tel:"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      a.setAttribute("href", "tel:" + targetE164);
      a.setAttribute("data-pct-original", a.getAttribute("data-pct-original") || a.textContent);
      // Only swap text if it looks like a phone number (avoid nuking icons/images)
      if (/\d{3}[^\d]*\d{3}[^\d]*\d{4}/.test(a.textContent)) {
        a.textContent = display;
      }
    }

    // 2. Any element with data-pct-phone also swaps its text
    var marks = document.querySelectorAll("[data-pct-phone]");
    for (var j = 0; j < marks.length; j++) {
      marks[j].textContent = display;
    }
  }

  // -------------------------------------------------------------------------
  // Click event → dashboard
  // -------------------------------------------------------------------------

  function sendClickEvent(payload) {
    try {
      var body = JSON.stringify(payload);
      // sendBeacon survives page unload (since tapping tel: unloads the page)
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(CFG.clickApi, blob);
        return;
      }
    } catch (_) { /* fall through */ }
    // Fallback — fire and forget
    try {
      fetch(CFG.clickApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    } catch (_) {}
  }

  function wireClickHandlers(attr, targetE164) {
    var handler = function () {
      var payload = {
        source: attr.channel,
        utm_campaign: attr.campaign || null,
        utm_adgroup: attr.adgroup || null,
        utm_source: attr.source || null,
        utm_medium: attr.channel === "paid" ? "cpc" : attr.channel,
        utm_term: attr.keyword || null,
        utm_content: attr.content || null,
        gclid: attr.gclid || null,
        gbraid: attr.gbraid || null,
        wbraid: attr.wbraid || null,
        referrer: attr.referrer || document.referrer || null,
        landing_page: window.location.href,
        phone_clicked: targetE164,
        timestamp: new Date().toISOString(),
      };
      sendClickEvent(payload);
      fireAdsConversion(targetE164);
    };

    var anchors = document.querySelectorAll('a[href^="tel:"]');
    for (var i = 0; i < anchors.length; i++) {
      anchors[i].addEventListener("click", handler, { passive: true });
      anchors[i].addEventListener("touchstart", handler, { passive: true });
    }
  }

  // -------------------------------------------------------------------------
  // Google Ads conversion on phone click
  // -------------------------------------------------------------------------

  function fireAdsConversion(phoneE164) {
    if (!window.gtag || !CFG.googleAdsId || CFG.googleAdsId === "AW-XXXXXXXXX") return;
    if (!CFG.phoneClickLabel || CFG.phoneClickLabel === "REPLACE_WITH_LABEL") return;
    try {
      window.gtag("event", "conversion", {
        send_to: CFG.googleAdsId + "/" + CFG.phoneClickLabel,
        phone_number: phoneE164,
      });
    } catch (_) {}
  }

  // -------------------------------------------------------------------------
  // Run
  // -------------------------------------------------------------------------

  function run() {
    var attr = getAttribution();
    var number = numberForChannel(attr.channel);
    swapPhoneNumbers(number);
    wireClickHandlers(attr, number);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
