// ---------------------------------------------------------------------------
// Deepgram transcription — downloads a Twilio recording and sends it to
// Deepgram for speech-to-text. Returns speaker-labeled utterances formatted
// as a chat-style transcript.
//
// Called automatically by the recording status callback after every call.
// No buttons, no manual steps.
// ---------------------------------------------------------------------------

export interface TranscriptUtterance {
  speaker: "caller" | "dispatcher";
  text: string;
  start: number; // seconds into the recording
}

export interface TranscriptionResult {
  /** Chat-style transcript: "Customer: ...\nDispatcher: ..." */
  transcript: string;
  /** Structured utterances for transcript_chunks jsonb column */
  utterances: TranscriptUtterance[];
}

export async function transcribeRecording(recordingUrl: string): Promise<TranscriptionResult | null> {
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

    // Send to Deepgram with multichannel + utterances.
    // Twilio records dual-channel audio (record-from-answer-dual): channel 0
    // is the caller, channel 1 is the dispatcher. Multichannel gives us
    // deterministic speaker mapping — no diarization guesswork.
    const dgRes = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&multichannel=true&punctuate=true&utterances=true",
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

    // Preferred: multichannel utterances (each has a `channel` field)
    const rawUtterances = result?.results?.utterances;
    if (Array.isArray(rawUtterances) && rawUtterances.length > 0) {
      const hasChannel = rawUtterances.some(
        (u: { channel?: number }) => typeof u.channel === "number",
      );
      if (hasChannel) return buildChatTranscriptMultichannel(rawUtterances);

      // Single-channel recording fell through (mono audio) — diarize fallback.
      return buildChatTranscriptDiarize(rawUtterances);
    }

    // Last-resort fallback: flat transcript from channel 0
    const flat =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || null;
    if (!flat) return null;

    return {
      transcript: flat,
      utterances: [{ speaker: "caller", text: flat, start: 0 }],
    };
  } catch (err) {
    console.error("Transcription failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Multichannel path (preferred): Twilio dual-channel recording gives us
// channel 0 = caller, channel 1 = dispatcher. No voice matching required.
// ---------------------------------------------------------------------------

function buildChatTranscriptMultichannel(
  rawUtterances: Array<{ channel?: number; transcript: string; start: number }>,
): TranscriptionResult {
  const utterances: TranscriptUtterance[] = rawUtterances
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((u) => ({
      speaker: (u.channel === 1 ? "dispatcher" : "caller") as "caller" | "dispatcher",
      text: u.transcript.trim(),
      start: u.start,
    }))
    .filter((u) => u.text.length > 0);

  const transcript = utterances
    .map((u) => `${u.speaker === "dispatcher" ? "Dispatcher" : "Customer"}: ${u.text}`)
    .join("\n");

  return { transcript, utterances };
}

// ---------------------------------------------------------------------------
// Diarize fallback (mono audio): guess dispatcher as the first speaker.
// Only used when multichannel info is unavailable.
// ---------------------------------------------------------------------------

function buildChatTranscriptDiarize(
  rawUtterances: Array<{ speaker?: number; transcript: string; start: number }>,
): TranscriptionResult {
  const dispatcherSpeaker = rawUtterances[0]?.speaker ?? 0;

  const utterances: TranscriptUtterance[] = rawUtterances.map((u) => ({
    speaker: u.speaker === dispatcherSpeaker ? "dispatcher" : "caller",
    text: u.transcript.trim(),
    start: u.start,
  }));

  const transcript = utterances
    .map((u) => `${u.speaker === "dispatcher" ? "Dispatcher" : "Customer"}: ${u.text}`)
    .join("\n");

  return { transcript, utterances };
}
