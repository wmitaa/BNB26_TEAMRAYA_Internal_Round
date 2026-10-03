# Roundtable

### Live Captions for Group Conversations

Roundtable is a web-based real-time captioning system designed for group conversations.

Unlike traditional live captioning that mainly works with one speaker and one microphone, Roundtable uses multiple nearby devices to improve speech understanding in real-world group conversations.

The system aims to provide low-latency captions while identifying which participant is speaking, even when there is background noise or overlapping speech.

---

## Problem Statement

Live captioning systems often perform well when a single person speaks clearly into a microphone.

Real conversations are different:

- Multiple people may speak at the same time.
- Participants may be sitting at different positions.
- Background noise can affect speech recognition.
- A single device may not capture every speaker clearly.
- It can be difficult to determine who said what.

Roundtable aims to solve these problems by coordinating multiple nearby devices and combining their information to create a shared conversation transcript.

---

## Key Goals

- Real-time speech-to-text
- Speaker attribution
- Multi-device conversation support
- Background noise handling
- Overlapping speech handling
- Low-latency captions
- Session continuity
- Shared live transcript

---

## Planned Features

### Core Features

- Create a conversation session
- Join a conversation using a room code
- Microphone access
- Multi-device participation
- Real-time speech-to-text
- Speaker identification / attribution
- Background noise handling
- Overlapping speaker handling
- Live captions
- Participant connection status
- Session continuity when participants join or leave

### Additional Features

- Speaker analytics
- Speaking-time analysis
- Conversation summary
- Decisions and action-item detection
- Question detection
- Conversation insights
- Conversation replay
- Overlap visualization

---

## Project Architecture

```text
RoundTABLE/
│
├── frontend/
│   └── React + Vite
│
├── backend/
│   └── Realtime server and session management
│
├── ai/
│   ├── stt/
│   ├── speaker/
│   ├── processing/
│   └── intelligence/
│
├── .gitignore
└── README.md