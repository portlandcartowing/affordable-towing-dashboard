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

    // Send to Deepgram with diarization + utterances
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

    // Try to build speaker-labeled transcript from utterances
    const rawUtterances = result?.results?.utterances;
    if (Array.isArray(rawUtterances) && rawUtterances.length > 0) {
      return buildChatTranscript(rawUtterances);
    }

    // Fallback: flat transcript (no speaker labels available)
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
// Build chat-style transcript from Deepgram utterances.
//
// Deepgram uses numeric speaker IDs (0, 1, ...). In a typical towing call
// the first speaker is the dispatcher (they answer the phone). Speaker 0
// = dispatcher, speaker 1 = caller/customer. If there are more speakers
// we label them as "caller" since multi-party calls are rare.
// ---------------------------------------------------------------------------

function buildChatTranscript(
  rawUtterances: Array<{ speaker: number; transcript: string; start: number }>,
): TranscriptionResult {
  // Determine which speaker ID is the dispatcher (first to speak = dispatcher)
  const dispatcherSpeaker = rawUtterances[0]?.speaker ?? 0;

  const utterances: TranscriptUtterance[] = rawUtterances.map((u) => ({
    speaker: u.speaker === dispatcherSpeaker ? "dispatcher" : "caller",
    text: u.transcript.trim(),
    start: u.start,
  }));

  // Format as readable chat-style text
  const transcript = utterances
    .map((u) => {
      const label = u.speaker === "dispatcher" ? "Dispatcher" : "Customer";
      return `${label}: ${u.text}`;
    })
    .join("\n");

  return { transcript, utterances };
}
