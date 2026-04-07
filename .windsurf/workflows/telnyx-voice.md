---
description: Telnyx Voice SDK reference for call control, transfer, bridge, and hangup
---

# Telnyx Voice - JavaScript

## Setup
```javascript
import Telnyx from 'telnyx';
const client = new Telnyx({ apiKey: process.env['TELNYX_API_KEY'] });
```

## Core Operations

### Dial outbound call
```javascript
const response = await client.calls.dial({
  connection_id: 'CONNECTION_UUID',
  from: '+18005550101',
  to: '+18005550100',
});
// response.data.callControlId, callLegId, callSessionId, isAlive
```

### Answer inbound call
```javascript
const response = await client.calls.actions.answer(callControlId, {
  webhookUrl: 'https://your-server/telnyx/webhook',
});
```

### Transfer a live call
```javascript
const response = await client.calls.actions.transfer(callControlId, {
  to: '+18005550100',
});
```

### Bridge two calls
```javascript
const response = await client.calls.actions.bridge(callControlId, {
  call_control_id_to_bridge_with: otherCallControlId,
});
```

### Hangup call
```javascript
const response = await client.calls.actions.hangup(callControlId);
```

### Reject call
```javascript
const response = await client.calls.actions.reject(callControlId, { cause: 'USER_BUSY' });
```

### Retrieve call status
```javascript
const response = await client.calls.retrieveStatus(callControlId);
// response.data.callControlId, callDuration, callLegId, callSessionId, clientState, endTime
```

### List active calls
```javascript
for await (const call of client.connections.listActiveCalls(connectionId)) {
  console.log(call.call_control_id);
}
```

## Webhook Verification
```javascript
app.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = await client.webhooks.unwrap(req.body.toString(), { headers: req.headers });
  console.log('Received event:', event.data.event_type);
  res.status(200).send('OK');
});
```

## Notes
- Phone numbers must be E.164 format (+13125550001)
- Call Control is event-driven — issue follow-up commands from webhook handlers
- A publicly reachable webhook endpoint is required for real call control
