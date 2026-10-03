// MOCK DATA ONLY. Used exclusively when MODE === "mock" (see utils/config.js). Never imported by real-data paths.

export const demoParticipants = [
  { id: 'p1', name: 'Mitali', color: 'green', connected: true, muted: false, speaking: false },
  { id: 'p2', name: 'Shrvni', color: 'blue', connected: true, muted: false, speaking: false },
  { id: 'p3', name: 'Anushka', color: 'orange', connected: true, muted: false, speaking: false },
];
export const demoTranscript = [
  { id: 't1', speakerId: 'p1', text: "Let's start with the main problem.", timestamp: '10:31:04', status: 'final', confidence: 0.96 },
  { id: 't2', speakerId: 'p2', text: 'I think we should focus on accessibility.', timestamp: '10:31:07', status: 'final', confidence: 0.93 },
  { id: 't3', speakerId: 'p3', text: 'Yes, and we can demonstrate multiple speakers.', timestamp: '10:31:10', status: 'final', confidence: 0.91 },
];
// [delayMs, eventName, payload] — mimics what the backend/AI layer will push.
export const demoScript = [
  [1200, 'speaker', { id: 'p1', speaking: true }],
  [1400, 'transcript', { id: 't4', speakerId: 'p1', text: "Let's discuss the...", status: 'interim' }],
  [2800, 'transcript', { id: 't4', speakerId: 'p1', text: "Let's discuss the main prob", status: 'updating' }],
  [4000, 'transcript', { id: 't4', speakerId: 'p1', text: "Let's discuss the main problem.", status: 'final', confidence: 0.95 }],
  [4100, 'speaker', { id: 'p1', speaking: false }],
  [5500, 'audio', { status: 'noise' }],
  [7000, 'overlap', { active: true, speakers: ['p1', 'p2'] }],
  [7000, 'speaker', { id: 'p1', speaking: true }],
  [7000, 'speaker', { id: 'p2', speaking: true }],
  [7100, 'transcript', { id: 't5', speakerId: 'p1', text: 'I think we should—', status: 'interim' }],
  [7300, 'transcript', { id: 't6', speakerId: 'p2', text: 'Yes, exactly—', status: 'interim' }],
  [9000, 'transcript', { id: 't5', speakerId: 'p1', text: 'I think we should start with the demo.', status: 'final', confidence: 0.82 }],
  [9100, 'transcript', { id: 't6', speakerId: 'p2', text: 'Yes, exactly—that works.', status: 'final', confidence: 0.78 }],
  [9200, 'overlap', { active: false, speakers: [] }],
  [9200, 'speaker', { id: 'p1', speaking: false }],
  [9200, 'speaker', { id: 'p2', speaking: false }],
  [10500, 'audio', { status: 'good' }],
  [12000, 'participants', { id: 'p4', name: 'Priya', color: 'purple', connected: true, muted: false, speaking: false }],
  [16000, 'status', 'reconnecting'],
  [19000, 'status', 'connected'],
];
