---
description: Telnyx Voice Gather SDK reference for DTMF gathering and AI assistant on calls
---

# Telnyx Voice Gather - JavaScript

## Setup
```javascript
import Telnyx from 'telnyx';
const client = new Telnyx({ apiKey: process.env['TELNYX_API_KEY'] });
```

## AI Assistant

### Start AI Assistant
```javascript
const response = await client.calls.actions.startAIAssistant(callControlId, {
  greeting: 'Hello! How can I help?',
  voice: 'male',
});
// response.data.conversation_id, result
```

### Add messages to AI Assistant
```javascript
const response = await client.calls.actions.addAIAssistantMessages(callControlId, {
  messages: [{ role: 'system', content: 'New context' }],
});
```

### Stop AI Assistant
```javascript
const response = await client.calls.actions.stopAIAssistant(callControlId);
```

## DTMF Gathering

### Gather DTMF
```javascript
const response = await client.calls.actions.gather(callControlId, {
  minimum_digits: 1,
  maximum_digits: 4,
  timeout_millis: 10000,
  valid_digits: '0123456789',
});
```

### Gather using AI (structured parameters)
```javascript
const response = await client.calls.actions.gatherUsingAI(callControlId, {
  parameters: { properties: {...}, required: [...], type: 'object' },
  greeting: 'Please provide your info',
});
// response.data.conversation_id, result
```

### Gather using Speak (TTS + DTMF)
```javascript
const response = await client.calls.actions.gatherUsingSpeak(callControlId, {
  payload: 'Press 1 for sales, 2 for support',
  voice: 'male',
  language: 'en-US',
  minimum_digits: 1,
  maximum_digits: 1,
});
```

### Stop Gather
```javascript
const response = await client.calls.actions.stopGather(callControlId);
```

## Expected Webhooks
- `call.gather.ended` — DTMF gather completed
- `call.conversation.ended` — AI assistant conversation ended
- `call.conversation_insights.generated` — AI insights ready
