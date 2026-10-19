// Ikon aplikasi: Phosphor duotone yang diberi warna sesuai maknanya (garis = warna utama, isian = warna lembut).
// Semua komponen dipakai lewat modul ini (bukan langsung dari @phosphor-icons/react) supaya warnanya seragam.
// Di latar berwarna (label terkunci, tombol aktif) ikon mengikuti warna teks — lihat .ico di styles.css.
import type { CSSProperties } from "react";
import * as P from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import type { NoticeIconName } from "../net";

type Icon = (props: IconProps) => React.JSX.Element;

function tint(Base: P.Icon, color: string): Icon {
  return function Tinted({ className, style, ...props }: IconProps) {
    return <Base {...props} className={className ? `ico ${className}` : "ico"} style={{ "--ico": color, ...style } as CSSProperties} />;
  };
}

const RED = "#e5484d";
const GREEN = "#2f9e6e";
const ORANGE = "#e8833a";
const AMBER = "#e0a21b";
const BLUE = "#3d7be0";
const INDIGO = "#5b63d6";
const TEAL = "#1f9d9a";
const PURPLE = "#8b5cf6";
const PINK = "#e0607e";
const BROWN = "#a0673a";
const SLATE = "#5b6b80";

export const ArrowCounterClockwiseIcon = tint(P.ArrowCounterClockwiseIcon, GREEN);
export const ArrowsClockwiseIcon = tint(P.ArrowsClockwiseIcon, ORANGE);
export const CalendarBlankIcon = tint(P.CalendarBlankIcon, BLUE);
export const ChairIcon = tint(P.ChairIcon, ORANGE);
export const ChalkboardSimpleIcon = tint(P.ChalkboardSimpleIcon, GREEN);
export const ChatCircleDotsIcon = tint(P.ChatCircleDotsIcon, BLUE);
export const CheckCircleIcon = tint(P.CheckCircleIcon, GREEN);
export const CheckIcon = tint(P.CheckIcon, GREEN);
export const CirclesFourIcon = tint(P.CirclesFourIcon, RED);
export const CubeIcon = tint(P.CubeIcon, INDIGO);
export const MapTrifoldIcon = tint(P.MapTrifoldIcon, TEAL);
export const DiceFiveIcon = tint(P.DiceFiveIcon, PURPLE);
export const DoorIcon = tint(P.DoorIcon, BROWN);
export const ElevatorIcon = tint(P.ElevatorIcon, INDIGO);
export const FootprintsIcon = tint(P.FootprintsIcon, PURPLE);
export const GearSixIcon = tint(P.GearSixIcon, SLATE);
export const GlobeIcon = tint(P.GlobeIcon, TEAL);
export const HandPalmIcon = tint(P.HandPalmIcon, AMBER);
export const HandWavingIcon = tint(P.HandWavingIcon, AMBER);
export const HourglassMediumIcon = tint(P.HourglassMediumIcon, AMBER);
export const JoystickIcon = tint(P.JoystickIcon, PURPLE);
export const KeyIcon = tint(P.KeyIcon, AMBER);
export const KeyboardIcon = tint(P.KeyboardIcon, SLATE);
export const LinkSimpleIcon = tint(P.LinkSimpleIcon, BLUE);
export const LockSimpleIcon = tint(P.LockSimpleIcon, RED);
export const LockSimpleOpenIcon = tint(P.LockSimpleOpenIcon, GREEN);
export const MagnifyingGlassIcon = tint(P.MagnifyingGlassIcon, BLUE);
export const MapPinIcon = tint(P.MapPinIcon, RED);
export const MegaphoneIcon = tint(P.MegaphoneIcon, ORANGE);
export const MicrophoneIcon = tint(P.MicrophoneIcon, GREEN);
export const MicrophoneSlashIcon = tint(P.MicrophoneSlashIcon, RED);
export const MicrophoneStageIcon = tint(P.MicrophoneStageIcon, PINK);
export const MonitorArrowUpIcon = tint(P.MonitorArrowUpIcon, INDIGO);
export const MonitorIcon = tint(P.MonitorIcon, INDIGO);
export const PaperclipIcon = tint(P.PaperclipIcon, SLATE);
export const PencilSimpleIcon = tint(P.PencilSimpleIcon, ORANGE);
export const ProhibitIcon = tint(P.ProhibitIcon, RED);
export const RecordIcon = tint(P.RecordIcon, RED);
export const RulerIcon = tint(P.RulerIcon, AMBER);
export const SignOutIcon = tint(P.SignOutIcon, RED);
export const SmileyIcon = tint(P.SmileyIcon, AMBER);
export const SpeakerHighIcon = tint(P.SpeakerHighIcon, GREEN);
export const SpeakerSimpleHighIcon = tint(P.SpeakerSimpleHighIcon, BLUE);
export const TShirtIcon = tint(P.TShirtIcon, PINK);
export const TrashIcon = tint(P.TrashIcon, RED);
export const TrophyIcon = tint(P.TrophyIcon, AMBER);
export const UsersIcon = tint(P.UsersIcon, BLUE);
export const VideoCameraIcon = tint(P.VideoCameraIcon, TEAL);
export const VideoCameraSlashIcon = tint(P.VideoCameraSlashIcon, RED);
export const WarningCircleIcon = tint(P.WarningCircleIcon, AMBER);
export const WrenchIcon = tint(P.WrenchIcon, ORANGE);

const NOTICE_ICONS: Record<NoticeIconName, Icon> = {
  check: CheckCircleIcon,
  door: DoorIcon,
  follow: FootprintsIcon,
  link: LinkSimpleIcon,
  lock: LockSimpleIcon,
  pin: MapPinIcon,
  summon: MegaphoneIcon,
  mute: MicrophoneSlashIcon,
  attach: PaperclipIcon,
  warn: WarningCircleIcon,
};

/** Ikon pemberitahuan: net.ts hanya menyimpan nama (tanpa React). */
export function NoticeIcon({ name }: { name: NoticeIconName }) {
  const I = NOTICE_ICONS[name];
  return <I />;
}
