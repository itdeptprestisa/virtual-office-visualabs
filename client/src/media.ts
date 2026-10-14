import { create } from "zustand";
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  VideoQuality,
  type RemoteTrackPublication,
  type RemoteAudioTrack,
  type Participant,
} from "livekit-client";
import { remoteState } from "./net";
import { PROXIMITY, audioLink, zoneAt } from "./zones";


type Status = "off" | "connecting" | "on" | "error";

interface MediaState {
  status: Status;
  mic: boolean;
  cam: boolean;
  canPlayAudio: boolean;
  // Track video kamera & share screen per identity (= id pemain), termasuk diri sendiri.
  videos: Record<string, Track | undefined>;
  screens: Record<string, Track | undefined>;
  sharing: boolean;
  speaking: Record<string, boolean>;
  nearby: number;
}

export const useMedia = create<MediaState>(() => ({
  status: "off",
  mic: false,
  cam: false,
  canPlayAudio: true,
  videos: {},
  screens: {},
  sharing: false,
  speaking: {},
  nearby: 0,
}));

// Kamera → bubble di atas kepala; share screen → panel/layar presentasi.
const setVideo = (identity: string, track: Track | undefined, source: Track.Source) =>
  source === Track.Source.ScreenShare
    ? useMedia.setState((s) => ({ screens: { ...s.screens, [identity]: track } }))
    : useMedia.setState((s) => ({ videos: { ...s.videos, [identity]: track } }));

// Elemen <audio> per track; dicatat sendiri karena LiveKit bisa melepasnya sebelum event unsubscribe.
const audioEls = new Map<string, HTMLMediaElement>();

export const room = new Room({
  // Kualitas diatur manual per jenis track (lihat TrackSubscribed): adaptiveStream menilai dari ukuran elemen
  // di halaman, padahal share screen juga tampil sebagai tekstur 3D di layar presentasi.
  adaptiveStream: false,
  dynacast: true, // layer simulcast yang tak ditonton tidak dikirim
  videoCaptureDefaults: { resolution: VideoPresets.h216.resolution },
  publishDefaults: { simulcast: true },
});

room
  .on(RoomEvent.TrackSubscribed, (track, pub: RemoteTrackPublication, participant) => {
    if (track.kind === Track.Kind.Video) {
      // Kamera cuma bubble kecil → kualitas rendah; share screen harus terbaca → kualitas tinggi.
      pub.setVideoQuality(track.source === Track.Source.ScreenShare ? VideoQuality.HIGH : VideoQuality.LOW);
    }
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      el.style.display = "none";
      document.body.appendChild(el);
      audioEls.set(track.sid ?? "", el);
    } else if (track.kind === Track.Kind.Video) {
      setVideo(participant.identity, track, track.source);
    }
  })
  .on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
    if (track.kind === Track.Kind.Audio) {
      track.detach();
      audioEls.get(track.sid ?? "")?.remove();
      audioEls.delete(track.sid ?? "");
    }
    else if (track.kind === Track.Kind.Video) setVideo(participant.identity, undefined, track.source);
  })
  .on(RoomEvent.LocalTrackPublished, (pub, participant) => {
    if (pub.kind === Track.Kind.Video) setVideo(participant.identity, pub.track, pub.source);
    if (pub.source === Track.Source.ScreenShare) useMedia.setState({ sharing: true });
  })
  .on(RoomEvent.LocalTrackUnpublished, (pub, participant) => {
    if (pub.kind === Track.Kind.Video) setVideo(participant.identity, undefined, pub.source);
    // Termasuk saat dihentikan lewat tombol "Stop sharing" bawaan browser.
    if (pub.source === Track.Source.ScreenShare) useMedia.setState({ sharing: false });
  })
  .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
    useMedia.setState({ speaking: Object.fromEntries(speakers.map((p) => [p.identity, true])) });
  })
  .on(RoomEvent.AudioPlaybackStatusChanged, () => {
    useMedia.setState({ canPlayAudio: room.canPlaybackAudio });
  })
  .on(RoomEvent.Disconnected, () => {
    audioEls.forEach((el) => el.remove());
    audioEls.clear();
    useMedia.setState({ status: "off", mic: false, cam: false, videos: {}, screens: {}, sharing: false, speaking: {}, nearby: 0 });
  });

export async function connectMedia(url: string, token: string) {
  if (room.state !== "disconnected") return;
  useMedia.setState({ status: "connecting" });
  try {
    // autoSubscribe off: kita sendiri yang memilih track siapa yang diterima (hanya yang dekat).
    await room.connect(url, token, { autoSubscribe: false });
    useMedia.setState({ status: "on", canPlayAudio: room.canPlaybackAudio });
  } catch (err) {
    console.warn("LiveKit tidak tersedia:", err);
    useMedia.setState({ status: "error" });
  }
}

export async function toggleMic() {
  const next = !useMedia.getState().mic;
  try {
    await room.startAudio();
    await room.localParticipant.setMicrophoneEnabled(next);
    useMedia.setState({ mic: next });
  } catch (err) {
    console.warn("Mikrofon gagal:", err);
  }
}

/** Matikan mic (mis. "mute semua" di ruang meeting). */
export async function muteMic() {
  if (!useMedia.getState().mic) return;
  try {
    await room.localParticipant.setMicrophoneEnabled(false);
    useMedia.setState({ mic: false });
  } catch (err) {
    console.warn("Gagal mematikan mic:", err);
  }
}

export async function toggleCam() {
  const next = !useMedia.getState().cam;
  try {
    await room.localParticipant.setCameraEnabled(next);
    useMedia.setState({ cam: next });
  } catch (err) {
    console.warn("Kamera gagal:", err);
  }
}

// Share screen hanya di dalam area (yang melihat = orang di area yang sama).
export async function toggleScreen() {
  const next = !useMedia.getState().sharing;
  try {
    await room.localParticipant.setScreenShareEnabled(next, { audio: false, resolution: { width: 1920, height: 1080, frameRate: 15 } });
  } catch (err) {
    console.warn("Share screen gagal/dibatalkan:", err);
  }
}

export function enableAudio() {
  room.startAudio().then(() => useMedia.setState({ canPlayAudio: room.canPlaybackAudio }));
}

// Dipanggil beberapa kali per detik dari Player: atur langganan & volume tiap peserta sesuai jarak/zona.
export function updateProximity(x: number, z: number) {
  if (room.state !== "connected") return;
  // Keluar dari area → share screen otomatis berhenti.
  if (useMedia.getState().sharing && !zoneAt(x, z)) room.localParticipant.setScreenShareEnabled(false);
  let nearby = 0;

  for (const p of room.remoteParticipants.values()) {
    const s = remoteState.get(p.identity);
    const { distance, volume } = s ? audioLink(x, z, s.p[0], s.p[2]) : { distance: Infinity, volume: 0 };

    let subscribed = false;
    for (const pub of p.trackPublications.values()) {
      const want = distance < (pub.isSubscribed ? PROXIMITY.hear + PROXIMITY.hysteresis : PROXIMITY.hear);
      if (pub.isSubscribed !== want) pub.setSubscribed(want);
      if (pub.kind === Track.Kind.Audio && pub.track) (pub.track as RemoteAudioTrack).setVolume(volume * volume);
      subscribed ||= want;
    }
    if (subscribed || distance < PROXIMITY.hear) nearby++;
  }

  if (useMedia.getState().nearby !== nearby) useMedia.setState({ nearby });
}
