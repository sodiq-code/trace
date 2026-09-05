# Trace — Demo Script (90 seconds)

> Status: skeleton. The full 90-second demo script and recorded video are
> produced on Day 3 (report Sec 31.3 / Sec 50.5).

## Goal

In 90 seconds, show a judge that Trace stamps an AI-generated asset with a
cryptographically-verifiable C2PA provenance manifest — and that a third party
can verify it in under one second.

## 90-second beat sheet

| Time | Beat | Action |
| --- | --- | --- |
| 0:00–0:10 | Hook | "EU AI Act Article 50 makes provenance mandatory. Trace makes it one command." |
| 0:10–0:30 | The pain | Show a Midjourney thumbnail. No provenance. A sponsor can't tell if it's AI-generated. |
| 0:30–0:55 | The stamp | `trace stamp thumbnail.png --model midjourney-v6 --prompt "neon tech review"` → `[Valid]` in 0.5s |
| 0:55–1:15 | The verify | Open the Provenance Card URL → green "Cryptographic signature: VALID" → click "Verify cryptographically" → 200 OK |
| 1:15–1:30 | The moat | "Deterministic. Zero LLM calls. The Stripe of AI-content compliance." |

## Pre-demo checklist (Day 3)

- [ ] Pre-stamp 3 demo assets (image, audio, text) before recording
- [ ] Confirm `trace verify` returns `VALID` on all 3
- [ ] Confirm the public Provenance Card URL loads in an incognito window
- [ ] Record with OBS Studio at 1080p; keep demo assets under 5MB each
- [ ] Upload to YouTube as unlisted; link from the Devpost submission

## Demo-safe fallback

If the live demo fails (network down, laptop crash), play the 90-second
pre-recording. The Devpost submission includes both the live URL and the recording.
