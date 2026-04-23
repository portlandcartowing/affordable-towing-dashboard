import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// DNI Click Tracking Endpoint
//
// Called by the Dynamic Number Insertion script on portlandcartowing.com
// when a visitor clicks a phone number. Stores the visitor's source,
// UTM params, referrer, and which number they clicked.
//
// The voice webhook then matches incoming calls to click events by
// phone number + timestamp proximity for full attribution:
//   Ad campaign → landing page → phone click → inbound call → job
// ---------------------------------------------------------------------------

// Allow CORS from the website
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      source,
      utm_campaign,
      utm_adgroup,
      utm_source,
      utm_medium,
      utm_term,
      utm_content,
      gclid,
      gbraid,
      wbraid,
      referrer,
      landing_page,
      phone_clicked,
      timestamp,
    } = body;

    if (!source || !phone_clicked) {
      return NextResponse.json(
        { ok: false, error: "source and phone_clicked are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from("click_events")
      .insert({
        source,
        utm_campaign: utm_campaign || null,
        utm_adgroup: utm_adgroup || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_term: utm_term || null,
        utm_content: utm_content || null,
        gclid: gclid || null,
        gbraid: gbraid || null,
        wbraid: wbraid || null,
        referrer: referrer || null,
        landing_page: landing_page || null,
        phone_clicked: phone_clicked || null,
        visitor_ts: timestamp || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Click event insert error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { ok: true, id: data.id },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("Click tracking error:", err);
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400, headers: corsHeaders },
    );
  }
}
