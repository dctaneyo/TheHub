# LiveKit Integration Guide

This document explains how to integrate LiveKit for scalable video meetings in The Hub.

## Why LiveKit?

The current mesh WebRTC implementation works well for 3-6 participants but struggles with more due to:
- **Quadratic scaling**: Each participant maintains N-1 peer connections
- **Bandwidth**: Each participant uploads their stream N-1 times
- **CPU**: Managing many peer connections is resource-intensive

LiveKit uses an **SFU (Selective Forwarding Unit)** architecture where:
- Each participant sends ONE stream to the server
- The server forwards streams to other participants
- Scales to 100+ participants easily

## Setup Options

### Option 1: LiveKit Cloud (Recommended for Testing)

1. **Sign up**: https://cloud.livekit.io
2. **Free tier**: 10,000 participant-minutes/month
3. **Get credentials**:
   - API Key
   - API Secret
   - WebSocket URL (e.g., `wss://your-project.livekit.cloud`)

4. **Add to `.env`**:
```bash
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

### Option 2: Self-Hosted (For Production)

Deploy LiveKit server on Railway, Fly.io, or your own VPS:

```bash
# Using Docker
docker run -d \
  --name livekit \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v $PWD/livekit.yaml:/livekit.yaml \
  livekit/livekit-server \
  --config /livekit.yaml
```

See: https://docs.livekit.io/deploy/

## Code Changes

### 1. Install Dependencies (Already Done)

```bash
npm install @livekit/components-react livekit-client livekit-server-sdk
```

### 2. API Endpoint (Already Created)

`src/app/api/livekit/token/route.ts` generates JWT tokens for room access.

### 3. Use the LiveKit Component

Replace the current `MeetingRoom` import with `MeetingRoomLiveKit`:

```tsx
// Before
import { MeetingRoom } from "@/components/meeting-room";

// After
import { MeetingRoomLiveKit } from "@/components/meeting-room-livekit";

// Usage (same props)
<MeetingRoomLiveKit
  meetingId={meetingId}
  title={title}
  isHost={isHost}
  onLeave={handleLeave}
/>
```

## Features Included

The LiveKit integration provides:

✅ **HD video** - Automatic quality adaptation based on bandwidth
✅ **Screen sharing** - Built-in with automatic layout switching
✅ **Chat** - Real-time text chat
✅ **Participant management** - Mute, kick, promote
✅ **Recording** - Server-side recording (cloud tier or self-hosted)
✅ **Mobile support** - Responsive design
✅ **Network resilience** - Automatic reconnection and quality adjustment

## Comparison

| Feature | Mesh WebRTC (Current) | LiveKit SFU |
|---------|----------------------|-------------|
| Max participants (smooth) | 6 | 100+ |
| Upload bandwidth (10 people) | ~30 Mbps | ~3 Mbps |
| Server required | No | Yes |
| Setup complexity | Low | Medium |
| Cost | Free | Free tier or $10-20/mo self-hosted |
| Recording | Manual | Built-in |
| Mobile performance | Poor at scale | Excellent |

## Migration Steps

1. **Set up LiveKit** (cloud or self-hosted)
2. **Add environment variables** to `.env`
3. **Test the integration**:
   ```tsx
   // In src/components/arl/scheduled-meetings.tsx
   // Change the import at the top
   import { MeetingRoomLiveKit as MeetingRoom } from "@/components/meeting-room-livekit";
   ```
4. **Verify** meetings work with multiple participants
5. **Deploy** to production

## Customization

The current implementation uses LiveKit's built-in `VideoConference` component for simplicity. To customize the UI:

1. Use LiveKit hooks: `useParticipants()`, `useTracks()`, `useLocalParticipant()`
2. Build custom layouts with `<VideoTrack>` and `<AudioTrack>` components
3. See: https://docs.livekit.io/guides/room/receive/

## Cost Estimate

**Cloud (Free Tier)**:
- 10,000 participant-minutes/month
- Example: 50 meetings × 10 participants × 20 minutes = 10,000 minutes
- Perfect for testing and small-scale use

**Self-Hosted**:
- Railway/Fly.io: ~$10-20/month
- AWS/GCP: ~$20-50/month (depending on traffic)
- Unlimited usage

## Support

- LiveKit Docs: https://docs.livekit.io
- Discord: https://livekit.io/discord
- GitHub: https://github.com/livekit/livekit
