// ---------------------------------------------------------------------------
// Deepgram transcription — downloads a Twilio recording and sends it to
// Deepgram for speech-to-text. Returns the full transcript text.
//
// Called automatically by the recording status callback after every call.
// No buttons, no manual steps.
// ---------------------------------------------------------------------------

export async function transcribeRecording(recordingUrl: string): Promise<string | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error("DEEPGRAM_API_KEY not set");
    return null;
  }

  try {
    // Download the recording audio from Twilio (via our proxy or direct)
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;

    let audioUrl = recordingUrl;
    // If it's our proxy URL, convert back to Twilio direct URL for server-side fetch
    if (recordingUrl.includes("/api/twilio/recording/")) {
      const sid = recordingUrl.split("/api/twilio/recording/")[1];
      audioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.mp3`;
    }

    const audioRes = await fetch(audioUrl, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      },
    });

    if (!audioRes.ok) {
      console.error("Failed to download recording:", audioRes.status);
      return null;
    }

    const audioBuffer = await audioRes.arrayBuffer();

    // Send to Deepgram
    const dgRes = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&utterances=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "audio/mpeg",
        },
        body: Buffer.from(audioBuffer),
      },
    );

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error("Deepgram error:", dgRes.status, errText);
      return null;
    }

    const result = await dgRes.json();

    // Extract transcript from Deepgram response
    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || null;

    return transcript;
  } catch (err) {
    console.error("Transcription failed:", err);
    return null;
  }
}
