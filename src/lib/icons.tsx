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

// Helper: wraps a Phosphor icon with weight="duotone" as default
type IconComponent = React.ForwardRefExoticComponent<
  PhosphorIconProps & React.RefAttributes<SVGSVGElement>
>;

function duotone(Icon: IconComponent, displayName: string) {
  const Wrapped = forwardRef<SVGSVGElement, PhosphorIconProps>((props, ref) => (
    <Icon ref={ref} weight="duotone" {...props} />
  ));
  Wrapped.displayName = displayName;
  return Wrapped;
}

// ─── Exports: Lucide name → Phosphor duotone icon ───────────────────────────

export const Activity = duotone(Pulse, "Activity");
export const AlertCircle = duotone(WarningCircle, "AlertCircle");
export const AlertTriangle = duotone(Warning, "AlertTriangle");
export const Archive = duotone(PhArchive, "Archive");
export const ArrowLeft = duotone(PhArrowLeft, "ArrowLeft");
export const ArrowRight = duotone(PhArrowRight, "ArrowRight");
export const ArrowRightLeft = duotone(ArrowsLeftRight, "ArrowRightLeft");
export const ArrowUp = duotone(PhArrowUp, "ArrowUp");
export const AudioLines = duotone(Waveform, "AudioLines");
export const Award = duotone(PhMedal, "Award");
export const BarChart3 = duotone(ChartBar, "BarChart3");
export const Bell = duotone(PhBell, "Bell");
export const BellOff = duotone(BellSlash, "BellOff");
export const BookOpen = duotone(PhBookOpen, "BookOpen");
export const Building2 = duotone(Buildings, "Building2");
export const Calendar = duotone(PhCalendar, "Calendar");
export const CalendarDays = duotone(CalendarDots, "CalendarDays");
export const Check = duotone(PhCheck, "Check");
export const CheckCheck = duotone(Checks, "CheckCheck");
export const CheckCircle = duotone(PhCheckCircle, "CheckCircle");
export const CheckCircle2 = duotone(PhCheckCircle, "CheckCircle2");
export const CheckSquare = duotone(PhCheckSquare, "CheckSquare");
export const ChevronDown = duotone(CaretDown, "ChevronDown");
export const ChevronLeft = duotone(CaretLeft, "ChevronLeft");
export const ChevronRight = duotone(CaretRight, "ChevronRight");
export const ChevronUp = duotone(CaretUp, "ChevronUp");
export const Circle = duotone(PhCircle, "Circle");
export const ClipboardCheck = duotone(ClipboardText, "ClipboardCheck");
export const ClipboardList = duotone(ClipboardText, "ClipboardList");
export const Clock = duotone(PhClock, "Clock");
export const CloudOff = duotone(CloudSlash, "CloudOff");
export const Copy = duotone(PhCopy, "Copy");
export const CornerDownLeft = duotone(ArrowBendDownLeft, "CornerDownLeft");
export const Crown = duotone(PhCrown, "Crown");
export const Database = duotone(PhDatabase, "Database");
export const Delete = duotone(Backspace, "Delete");
export const DoorOpen = duotone(PhDoorOpen, "DoorOpen");
export const Download = duotone(PhDownload, "Download");
export const Edit2 = duotone(PencilSimple, "Edit2");
export const Edit3 = duotone(PencilLine, "Edit3");
export const Eye = duotone(PhEye, "Eye");
export const EyeOff = duotone(EyeSlash, "EyeOff");
export const FileText = duotone(PhFileText, "FileText");
export const Filter = duotone(Funnel, "Filter");
export const Flame = duotone(Fire, "Flame");
export const FolderOpen = duotone(PhFolderOpen, "FolderOpen");
export const Globe = duotone(PhGlobe, "Globe");
export const Hand = duotone(PhHand, "Hand");
export const HandMetal = duotone(HandFist, "HandMetal");
export const HardDrive = duotone(PhHardDrive, "HardDrive");
export const Hash = duotone(PhHash, "Hash");
export const Heart = duotone(PhHeart, "Heart");
export const HelpCircle = duotone(Question, "HelpCircle");
export const Info = duotone(PhInfo, "Info");
export const KeyRound = duotone(Key, "KeyRound");
export const Keyboard = duotone(PhKeyboard, "Keyboard");
export const Laugh = duotone(SmileyWink, "Laugh");
export const ListChecks = duotone(PhListChecks, "ListChecks");
export const Loader2 = duotone(SpinnerGap, "Loader2");
export const Lock = duotone(PhLock, "Lock");
export const LogIn = duotone(SignIn, "LogIn");
export const LogOut = duotone(SignOut, "LogOut");
export const Mail = duotone(Envelope, "Mail");
export const MapPin = duotone(PhMapPin, "MapPin");
export const Maximize2 = duotone(ArrowsOut, "Maximize2");
export const Medal = duotone(PhMedal, "Medal");
export const Megaphone = duotone(PhMegaphone, "Megaphone");
export const Menu = duotone(List, "Menu");
export const MessageCircle = duotone(ChatCircle, "MessageCircle");
export const Mic = duotone(Microphone, "Mic");
export const MicOff = duotone(MicrophoneSlash, "MicOff");
export const Minimize2 = duotone(ArrowsIn, "Minimize2");
export const Monitor = duotone(PhMonitor, "Monitor");
export const MonitorOff = duotone(Power, "MonitorOff");
export const Moon = duotone(PhMoon, "Moon");
export const MoreVertical = duotone(DotsThreeVertical, "MoreVertical");
export const Palette = duotone(PhPalette, "Palette");
export const Pause = duotone(PhPause, "Pause");
export const Pencil = duotone(PhPencil, "Pencil");
export const PhoneOff = duotone(PhoneDisconnect, "PhoneOff");
export const Play = duotone(PhPlay, "Play");
export const Plus = PhPlus;
export const Radio = duotone(Broadcast, "Radio");
export const RefreshCw = duotone(ArrowsClockwise, "RefreshCw");
export const Repeat = duotone(PhRepeat, "Repeat");
export const Save = duotone(FloppyDisk, "Save");
export const ScrollText = duotone(Scroll, "ScrollText");
export const Search = duotone(MagnifyingGlass, "Search");
export const Send = duotone(PaperPlaneTilt, "Send");
export const Settings = duotone(GearSix, "Settings");
export const Settings2 = duotone(GearSix, "Settings2");
export const Shield = duotone(PhShield, "Shield");
export const ShieldCheck = duotone(PhShieldCheck, "ShieldCheck");
export const Smartphone = duotone(DeviceMobile, "Smartphone");
export const Smile = duotone(Smiley, "Smile");
export const Snowflake = duotone(PhSnowflake, "Snowflake");
export const Space = duotone(Minus, "Space");
export const Sparkles = duotone(Sparkle, "Sparkles");
export const SprayCan = duotone(SprayBottle, "SprayCan");
export const Square = duotone(PhSquare, "Square");
export const Star = duotone(PhStar, "Star");
export const Store = duotone(Storefront, "Store");
export const Sun = duotone(PhSun, "Sun");
export const SwitchCamera = duotone(CameraRotate, "SwitchCamera");
export const Tablet = duotone(DeviceTablet, "Tablet");
export const Target = duotone(Crosshair, "Target");
export const TestTube = duotone(PhTestTube, "TestTube");
export const ThumbsUp = duotone(PhThumbsUp, "ThumbsUp");
export const Timer = duotone(PhTimer, "Timer");
export const Trash2 = duotone(Trash, "Trash2");
export const TrendingDown = duotone(TrendDown, "TrendingDown");
export const TrendingUp = duotone(TrendUp, "TrendingUp");
export const Trophy = duotone(PhTrophy, "Trophy");
export const Undo2 = duotone(ArrowCounterClockwise, "Undo2");
export const Unlink = duotone(LinkBreak, "Unlink");
export const Upload = duotone(PhUpload, "Upload");
export const User = duotone(PhUser, "User");
export const UserCheck = duotone(PhUserCheck, "UserCheck");
export const UserMinus = duotone(PhUserMinus, "UserMinus");
export const UserPlus = duotone(PhUserPlus, "UserPlus");
export const UserX = duotone(PhUserMinus, "UserX");
export const Users = duotone(UsersThree, "Users");
export const Video = duotone(VideoCamera, "Video");
export const VideoOff = duotone(VideoCameraSlash, "VideoOff");
export const Volume2 = duotone(SpeakerHigh, "Volume2");
export const VolumeX = duotone(SpeakerSlash, "VolumeX");
export const Wifi = duotone(WifiHigh, "Wifi");
export const WifiOff = duotone(WifiSlash, "WifiOff");
export const X = PhX;
export const XCircle = duotone(PhXCircle, "XCircle");
export const XIcon = PhX;
export const CheckSquareOffset = duotone(ClipboardText, "CheckSquareOffset");
export const LayoutGrid = duotone(SquaresFour, "LayoutGrid");
export const Zap = duotone(Lightning, "Zap");
