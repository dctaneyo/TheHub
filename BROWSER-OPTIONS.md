# Browser Implementation Options for The Hub

## Overview
Implementation of a restricted browser within The Hub kiosk application for touchscreen devices running in Chrome Kiosk mode.

## Option 1: Iframe with Whitelist (Simplest)

### Pros
- **Simple implementation** - Native browser feature, no extra dependencies
- **Fast development** - Can implement in 1-2 hours
- **Lightweight** - No additional packages needed
- **Secure sandboxing** - Built-in iframe sandbox attributes
- **Touch-friendly** - Native browser touch gestures work
- **Cost-effective** - No server resources needed

### Cons
- **Limited control** - Can't customize UI much
- **XSS vulnerabilities** - Iframes can still execute malicious scripts
- **Navigation restrictions** - Hard to intercept all navigation attempts
- **Cookie isolation** - Sites can still set cookies
- **Mobile compatibility** - Some sites block iframe embedding
- **No content filtering** - Can't modify page content

## Option 2: Webview Proxy Service

### Pros
- **Full control** - Can modify/filter any content
- **Enhanced security** - Server-side validation and sanitization
- **Content modification** - Can inject custom CSS/JS
- **Cookie management** - Server controls all cookies
- **Analytics** - Track usage and block unauthorized actions
- **Cross-origin freedom** - Can bypass iframe restrictions

### Cons
- **Complex implementation** - Requires proxy server and sanitization
- **Performance overhead** - Double network hop (user→proxy→site)
- **Server costs** - Additional resource usage
- **HTTPS issues** - Mixed content problems
- **Maintenance burden** - Need to handle edge cases constantly
- **Touch limitations** - Need to implement custom touch handling

## Option 3: Native Webview Component

### Pros
- **Best UX** - Native browser-like experience
- **Full control** - Can intercept all navigation, scripts, cookies
- **Performance** - Direct rendering, no proxy overhead
- **Security** - Granular control over permissions
- **Touch optimized** - Native touch gestures and scrolling
- **Feature rich** - Can add custom toolbars, bookmarks, etc.

### Cons
- **Dependency risk** - Requires third-party library
- **Complex setup** - May need native modules
- **Browser compatibility** - Different behavior across browsers
- **Development time** - 1-2 weeks to implement properly
- **Updates** - Library updates may break functionality
- **Limited ecosystem** - Fewer mature options for web

## Recommendation for The Hub

**Start with Option 1 (Iframe)** because:
- Your kiosk setup already restricts everything
- Chrome Kiosk mode provides additional security layers
- Quick to implement and test
- Can upgrade later if needed

**Upgrade to Option 3** if you need:
- Custom UI/branding
- Advanced security features
- Better touch experience

**Avoid Option 2** unless you need:
- Content modification
- Advanced analytics
- Complex filtering

The iframe approach gives you 80% of the functionality with 20% of the effort.

## Implementation Notes

### Security Considerations
- Chrome Kiosk mode already provides OS-level restrictions
- Whitelist domains in database for easy management
- Use iframe sandbox attributes to limit capabilities
- Implement session timeouts and activity monitoring

### Touch Optimization
- Large navigation buttons (minimum 44px)
- Swipe gestures for back/forward
- Pinch-to-zoom support
- On-screen keyboard integration

### Integration Points
- Add to main dashboard navigation
- ARL management for whitelist
- Usage analytics and reporting
- Emergency exit to dashboard

---

## Remote View / Remote Control

### Overview
Smart DOM + Event Streaming hybrid approach that lets ARLs (admins) see a live reconstruction of a kiosk location's screen, observe user interactions (touches, clicks, scrolling), and optionally take remote control to assist the user.

### Architecture

```
┌──────────────┐     Socket.io     ┌──────────────┐     Socket.io     ┌──────────────┐
│   Location   │ ───────────────▸ │    Server    │ ───────────────▸ │     ARL      │
│   (Kiosk)    │ DOM snapshots    │  (relay +    │  forwarded       │  (Viewer)    │
│              │ cursor pos       │   session    │  snapshots       │              │
│              │ user events      │   mgmt)      │  cursor/events   │              │
│              │ ◂─────────────── │              │ ◂─────────────── │              │
│              │  remote actions  │              │  remote actions   │              │
└──────────────┘                  └──────────────┘                  └──────────────┘
```

### How It Works

1. **ARL requests view** — Selects an online location from the Remote View panel
2. **Location consent** — A banner appears on the kiosk asking the user to allow/decline (auto-declines after 30s)
3. **DOM capture starts** — On accept, the `RemoteCaptureManager` begins:
   - Sending DOM snapshots every 2 seconds (interactive elements, text, layout)
   - Streaming cursor/touch position at ~15fps via `volatile` emit (drops if slow)
   - Forwarding click/input events as they happen
4. **ARL views reconstruction** — SVG-based rendering of the captured DOM with:
   - Interactive element highlighting (buttons, inputs, links)
   - Live cursor indicator (red dot showing where the user is touching/clicking)
   - Activity feed showing user interactions in real-time
5. **Remote control** — ARL can toggle control mode to:
   - Click on elements (resolved by selector or coordinates)
   - Scroll the page
   - Type into input fields (uses native setter for React compatibility)
   - Send keyboard events
6. **Session end** — Either side can end the session at any time

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/socket-handlers/types.ts` | Type definitions: `DOMSnapshot`, `RemoteViewSession`, `RemoteAction`, `UserEvent`, `CapturedElement` |
| `src/lib/socket-handlers/state.ts` | Global `remoteViewSessions` Map (survives HMR) |
| `src/lib/socket-handlers/remote-view.ts` | Server-side socket event handlers (request, accept, reject, snapshot relay, action relay, disconnect cleanup) |
| `src/lib/remote-capture.ts` | Client-side DOM capture engine + `RemoteCaptureManager` class + `executeRemoteAction()` |
| `src/components/dashboard/remote-view-banner.tsx` | Kiosk-side consent banner + active session indicator |
| `src/components/arl/remote-viewer.tsx` | ARL-side viewer UI (location picker, SVG DOM renderer, side panel, activity feed) |

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `remote-view:request` | ARL → Server → Location | ARL requests to view a location |
| `remote-view:accept` | Location → Server → ARL | Location accepts the request |
| `remote-view:reject` | Location → Server → ARL | Location declines the request |
| `remote-view:snapshot` | Location → Server → ARL | DOM snapshot (every 2s + after interactions) |
| `remote-view:cursor` | Location → Server → ARL | Cursor/touch position (~15fps, volatile) |
| `remote-view:user-event` | Location → Server → ARL | Click/input/scroll events |
| `remote-view:action` | ARL → Server → Location | Remote click/input/scroll/keyboard action |
| `remote-view:toggle-control` | ARL → Server → Both | Enable/disable remote control mode |
| `remote-view:end` | Either → Server → Both | End the session |
| `remote-view:ended` | Server → Both | Session ended notification (includes disconnect cleanup) |

### Performance Characteristics

- **Snapshot latency**: ~50-150ms (DOM capture + socket transit)
- **Cursor latency**: ~30-80ms (volatile emit, lightweight payload)
- **Bandwidth**: ~2-10 KB per snapshot (JSON, no pixels)
- **CPU impact on kiosk**: Minimal — reads DOM rects, no canvas/screenshot
- **Max elements per snapshot**: 300 (configurable in `remote-capture.ts`)

### Security

- **Consent required** — Location must explicitly accept each view request
- **Auto-reject** — Unanswered requests expire after 30 seconds
- **One session at a time** — Location auto-rejects if already being viewed
- **Session isolation** — Each session uses a dedicated Socket.io room
- **Disconnect cleanup** — Sessions automatically end if either side disconnects
- **Control toggle** — Remote control is off by default; ARL must explicitly enable it
- **Visual indicators** — Location always sees a prominent banner when being viewed/controlled
