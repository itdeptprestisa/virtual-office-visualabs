# Virtual Office

A 3D virtual office in the browser, in the spirit of Gather and ZEP — walk around as a customizable avatar,
talk to whoever is near you, and drop into rooms for private meetings. Built for teams of ~50 people.

![Office overview](docs/screenshots/overview.png)

| | |
|---|---|
| ![Lounge, third-person close-up](docs/screenshots/lounge-closeup.png) | ![Meeting room with whiteboard and raised hand](docs/screenshots/meeting-room.png) |
| **Zoom in** for a third-person view; zoom out for the bird's-eye view above. | **Meeting rooms**: shared whiteboard on the wall, raised hands, area-only chat. |
| ![Avatar editor](docs/screenshots/avatar-editor.png) | ![Member list and direct messages](docs/screenshots/members-chat.png) |
| **Avatar editor**: body, skin tone, hair or hijab, outfit, colors, glasses, hats. | **Members & presence**: who's online, where they are, DMs, locate & summon. |

> The UI is currently in Indonesian.

## Features

**Spatial audio & video (LiveKit)**
- **Areas** — rooms (glass walls + door), open areas (lounge, pantry) and every desk. Everyone in the same area
  is connected at full volume; people outside can't listen in.
- **Proximity** outside areas — 4 m hearing radius (drawn on the floor), full volume within 2 m.
- Video shows as a bubble above each avatar; screen sharing is scoped to your area and appears on the room's
  presentation screen.

**Office life**
- **Desks** — claim a desk, then lock it (🔒 focus mode) so nobody can walk in.
- **Doors** — open/close with **F**; people inside can lock the door, people outside can only knock.
  The lock releases automatically when the room empties.
- **Sit** on desk chairs, sofas and meeting chairs (**C**), emotes (wave, thumbs up, dance).
- **Meetings** — raise hand, mute everyone in the room, shared whiteboard.

**Communication & presence**
- Chat tabs: **Area** (only people who can hear you), **Everyone**, and **direct messages**; `@username` mentions.
- Member list with automatic status — available, in a meeting (in a room or from your calendar), focus, away
  (tab hidden) — or set it manually; jump to someone, or summon them to you.
- Sound + desktop notifications, unread count in the tab title.
- **Calendar** — paste your secret iCal link (e.g. Google Calendar) to show "in a meeting" automatically.

**Accounts & admin**
- Username/password accounts (scrypt), 30-day sessions, one active connection per account, auto-reconnect.
- The **first registered account becomes admin**. Admins can require an invite code, change roles,
  kick or disable accounts, and **edit the floor plan in-app** (drag furniture, **R** rotate, **Del** delete,
  add/resize rooms and areas) — changes are saved and pushed to everyone live.

**Rendering** — React Three Fiber, Rapier physics, stylized low-poly avatars built in code, ambient occlusion,
bloom and tone mapping, with an automatic low-quality mode when the frame rate drops. Touch joystick on mobile.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Walk (relative to camera) · **Shift** to run |
| Drag / Q·E · scroll | Rotate camera · zoom (close = third-person, far = top-down) |
| C · F | Sit / stand · open, close or knock on a door |
| 1 · 2 · 3 | Wave · thumbs up · dance |
| M · V · Enter | Mic · camera · chat |

## Getting started

```bash
brew install livekit   # once — local audio/video server
npm install
npm run dev            # LiveKit (dev mode) + game server + client
npm test               # unit + integration tests
```

Open http://localhost:5173 and register — the first account becomes admin. Requires Node ≥ 20.

To use LiveKit Cloud instead of the local dev server, copy `server/.env.example` to `server/.env` and fill in
your credentials. **Always set real LiveKit credentials when deploying** — without them the server falls back to
LiveKit's public dev keys.

## Project layout

```
client/   Vite + React + React Three Fiber + Rapier + Zustand + LiveKit client
server/   Node + ws (game state, chat, accounts) + LiveKit tokens; data in server/data/db.json
shared/   Floor-plan model & area rules, used by both server and client
```

## Roadmap

- Deploy with HTTPS (camera/mic on other devices require it)
- Google sign-in, Slack integration
