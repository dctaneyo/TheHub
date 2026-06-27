"use client";

import React, { forwardRef } from "react";
import type { IconProps as PhosphorIconProps } from "@phosphor-icons/react";
import {
  Archive as PhArchive,
  ArrowBendDownLeft,
  ArrowCounterClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowsClockwise,
  ArrowsIn,
  ArrowsLeftRight,
  ArrowsOut,
  ArrowUp as PhArrowUp,
  Backspace,
  Bell as PhBell,
  BellSlash,
  BookOpen as PhBookOpen,
  Broadcast,
  Buildings,
  Calendar as PhCalendar,
  CalendarDots,
  CameraRotate,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  ChatCircle,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  Checks,
  CheckSquare as PhCheckSquare,
  Circle as PhCircle,
  ClipboardText,
  Clock as PhClock,
  CloudSlash,
  Copy as PhCopy,
  Crosshair,
  Crown as PhCrown,
  Database as PhDatabase,
  DeviceMobile,
  DeviceTablet,
  DoorOpen as PhDoorOpen,
  DotsThreeVertical,
  Download as PhDownload,
  Envelope,
  Eye as PhEye,
  EyeSlash,
  FileText as PhFileText,
  Fire,
  FloppyDisk,
  FolderOpen as PhFolderOpen,
  Funnel,
  GearSix,
  Globe as PhGlobe,
  Hand as PhHand,
  HandFist,
  HardDrive as PhHardDrive,
  Hash as PhHash,
  Heart as PhHeart,
  Info as PhInfo,
  Key,
  Keyboard as PhKeyboard,
  Lightning,
  LinkBreak,
  List,
  ListChecks as PhListChecks,
  Lock as PhLock,
  MagnifyingGlass,
  MapPin as PhMapPin,
  Medal as PhMedal,
  Megaphone as PhMegaphone,
  Microphone,
  MicrophoneSlash,
  Minus,
  Monitor as PhMonitor,
  Moon as PhMoon,
  Palette as PhPalette,
  PaperPlaneTilt,
  Pause as PhPause,
  Pencil as PhPencil,
  PencilLine,
  PencilSimple,
  PhoneDisconnect,
  Play as PhPlay,
  Plus as PhPlus,
  Power,
  Pulse,
  Question,
  Quotes as PhQuotes,
  Repeat as PhRepeat,
  Scroll,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  SignIn,
  SignOut,
  Smiley,
  SmileyWink,
  Snowflake as PhSnowflake,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  SpinnerGap,
  SprayBottle,
  Square as PhSquare,
  SquaresFour,
  Star as PhStar,
  Storefront,
  Sun as PhSun,
  Target as PhTarget,
  TestTube as PhTestTube,
  ThumbsUp as PhThumbsUp,
  Timer as PhTimer,
  Trash,
  TrendDown,
  TrendUp,
  Trophy as PhTrophy,
  Upload as PhUpload,
  User as PhUser,
  UserCheck as PhUserCheck,
  UserMinus as PhUserMinus,
  UserPlus as PhUserPlus,
  UsersThree,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
  Warning,
  Waveform,
  WifiHigh,
  WifiSlash,
  X as PhX,
  XCircle as PhXCircle,
} from "@phosphor-icons/react";

// Helper: wraps a Phosphor icon with weight="bold" as default — every icon
// in the app uses the same weight (Section 1 of DESIGN.md: one weight per
// register, no mixing duotone/regular/bold within the same UI).
type IconComponent = React.ForwardRefExoticComponent<
  PhosphorIconProps & React.RefAttributes<SVGSVGElement>
>;

function bold(Icon: IconComponent, displayName: string) {
  const Wrapped = forwardRef<SVGSVGElement, PhosphorIconProps>((props, ref) => (
    <Icon ref={ref} weight="bold" {...props} />
  ));
  Wrapped.displayName = displayName;
  return Wrapped;
}

// ─── Exports: Lucide name → Phosphor bold icon ──────────────────────────────

export const Activity = bold(Pulse, "Activity");
export const AlertCircle = bold(WarningCircle, "AlertCircle");
export const AlertTriangle = bold(Warning, "AlertTriangle");
export const Archive = bold(PhArchive, "Archive");
export const ArrowLeft = bold(PhArrowLeft, "ArrowLeft");
export const ArrowRight = bold(PhArrowRight, "ArrowRight");
export const ArrowRightLeft = bold(ArrowsLeftRight, "ArrowRightLeft");
export const ArrowUp = bold(PhArrowUp, "ArrowUp");
export const AudioLines = bold(Waveform, "AudioLines");
export const Award = bold(PhMedal, "Award");
export const BarChart3 = bold(ChartBar, "BarChart3");
export const Bell = bold(PhBell, "Bell");
export const BellOff = bold(BellSlash, "BellOff");
export const BookOpen = bold(PhBookOpen, "BookOpen");
export const Building2 = bold(Buildings, "Building2");
export const Calendar = bold(PhCalendar, "Calendar");
export const CalendarDays = bold(CalendarDots, "CalendarDays");
export const Check = bold(PhCheck, "Check");
export const CheckCheck = bold(Checks, "CheckCheck");
export const CheckCircle = bold(PhCheckCircle, "CheckCircle");
export const CheckCircle2 = bold(PhCheckCircle, "CheckCircle2");
export const CheckSquare = bold(PhCheckSquare, "CheckSquare");
export const ChevronDown = bold(CaretDown, "ChevronDown");
export const ChevronLeft = bold(CaretLeft, "ChevronLeft");
export const ChevronRight = bold(CaretRight, "ChevronRight");
export const ChevronUp = bold(CaretUp, "ChevronUp");
export const Circle = bold(PhCircle, "Circle");
export const ClipboardCheck = bold(ClipboardText, "ClipboardCheck");
export const ClipboardList = bold(ClipboardText, "ClipboardList");
export const Clock = bold(PhClock, "Clock");
export const CloudOff = bold(CloudSlash, "CloudOff");
export const Copy = bold(PhCopy, "Copy");
export const CornerDownLeft = bold(ArrowBendDownLeft, "CornerDownLeft");
export const Crown = bold(PhCrown, "Crown");
export const Database = bold(PhDatabase, "Database");
export const Delete = bold(Backspace, "Delete");
export const DoorOpen = bold(PhDoorOpen, "DoorOpen");
export const Download = bold(PhDownload, "Download");
export const Edit2 = bold(PencilSimple, "Edit2");
export const Edit3 = bold(PencilLine, "Edit3");
export const Eye = bold(PhEye, "Eye");
export const EyeOff = bold(EyeSlash, "EyeOff");
export const FileText = bold(PhFileText, "FileText");
export const Filter = bold(Funnel, "Filter");
export const Flame = bold(Fire, "Flame");
export const FolderOpen = bold(PhFolderOpen, "FolderOpen");
export const Globe = bold(PhGlobe, "Globe");
export const Hand = bold(PhHand, "Hand");
export const HandMetal = bold(HandFist, "HandMetal");
export const HardDrive = bold(PhHardDrive, "HardDrive");
export const Hash = bold(PhHash, "Hash");
export const Heart = bold(PhHeart, "Heart");
export const HelpCircle = bold(Question, "HelpCircle");
export const Info = bold(PhInfo, "Info");
export const KeyRound = bold(Key, "KeyRound");
export const Keyboard = bold(PhKeyboard, "Keyboard");
export const Laugh = bold(SmileyWink, "Laugh");
export const ListChecks = bold(PhListChecks, "ListChecks");
export const Loader2 = bold(SpinnerGap, "Loader2");
export const Lock = bold(PhLock, "Lock");
export const LogIn = bold(SignIn, "LogIn");
export const LogOut = bold(SignOut, "LogOut");
export const Mail = bold(Envelope, "Mail");
export const MapPin = bold(PhMapPin, "MapPin");
export const Maximize2 = bold(ArrowsOut, "Maximize2");
export const Medal = bold(PhMedal, "Medal");
export const Megaphone = bold(PhMegaphone, "Megaphone");
export const Menu = bold(List, "Menu");
export const MessageCircle = bold(ChatCircle, "MessageCircle");
export const Mic = bold(Microphone, "Mic");
export const MicOff = bold(MicrophoneSlash, "MicOff");
export const Minimize2 = bold(ArrowsIn, "Minimize2");
export const Monitor = bold(PhMonitor, "Monitor");
export const MonitorOff = bold(Power, "MonitorOff");
export const Moon = bold(PhMoon, "Moon");
export const MoreVertical = bold(DotsThreeVertical, "MoreVertical");
export const Palette = bold(PhPalette, "Palette");
export const Pause = bold(PhPause, "Pause");
export const Quotes = bold(PhQuotes, "Quotes");
export const Pencil = bold(PhPencil, "Pencil");
export const PhoneOff = bold(PhoneDisconnect, "PhoneOff");
export const Play = bold(PhPlay, "Play");
export const Plus = bold(PhPlus, "Plus");
export const Radio = bold(Broadcast, "Radio");
export const RefreshCw = bold(ArrowsClockwise, "RefreshCw");
export const Repeat = bold(PhRepeat, "Repeat");
export const Save = bold(FloppyDisk, "Save");
export const ScrollText = bold(Scroll, "ScrollText");
export const Search = bold(MagnifyingGlass, "Search");
export const Send = bold(PaperPlaneTilt, "Send");
export const Settings = bold(GearSix, "Settings");
export const Settings2 = bold(GearSix, "Settings2");
export const Shield = bold(PhShield, "Shield");
export const ShieldCheck = bold(PhShieldCheck, "ShieldCheck");
export const Smartphone = bold(DeviceMobile, "Smartphone");
export const Smile = bold(Smiley, "Smile");
export const Snowflake = bold(PhSnowflake, "Snowflake");
export const Space = bold(Minus, "Space");
export const Sparkles = bold(Sparkle, "Sparkles");
export const SprayCan = bold(SprayBottle, "SprayCan");
export const Square = bold(PhSquare, "Square");
export const Star = bold(PhStar, "Star");
export const Store = bold(Storefront, "Store");
export const Sun = bold(PhSun, "Sun");
export const SwitchCamera = bold(CameraRotate, "SwitchCamera");
export const Tablet = bold(DeviceTablet, "Tablet");
export const Target = bold(Crosshair, "Target");
export const TestTube = bold(PhTestTube, "TestTube");
export const ThumbsUp = bold(PhThumbsUp, "ThumbsUp");
export const Timer = bold(PhTimer, "Timer");
export const Trash2 = bold(Trash, "Trash2");
export const TrendingDown = bold(TrendDown, "TrendingDown");
export const TrendingUp = bold(TrendUp, "TrendingUp");
export const Trophy = bold(PhTrophy, "Trophy");
export const Undo2 = bold(ArrowCounterClockwise, "Undo2");
export const Unlink = bold(LinkBreak, "Unlink");
export const Upload = bold(PhUpload, "Upload");
export const User = bold(PhUser, "User");
export const UserCheck = bold(PhUserCheck, "UserCheck");
export const UserMinus = bold(PhUserMinus, "UserMinus");
export const UserPlus = bold(PhUserPlus, "UserPlus");
export const UserX = bold(PhUserMinus, "UserX");
export const Users = bold(UsersThree, "Users");
export const Video = bold(VideoCamera, "Video");
export const VideoOff = bold(VideoCameraSlash, "VideoOff");
export const Volume2 = bold(SpeakerHigh, "Volume2");
export const VolumeX = bold(SpeakerSlash, "VolumeX");
export const Wifi = bold(WifiHigh, "Wifi");
export const WifiOff = bold(WifiSlash, "WifiOff");
export const X = bold(PhX, "X");
export const XCircle = bold(PhXCircle, "XCircle");
export const XIcon = bold(PhX, "XIcon");
export const CheckSquareOffset = bold(ClipboardText, "CheckSquareOffset");
export const LayoutGrid = bold(SquaresFour, "LayoutGrid");
export const Zap = bold(Lightning, "Zap");
