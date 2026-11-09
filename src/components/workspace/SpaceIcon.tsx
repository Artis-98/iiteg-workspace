import { useState } from "react";
import {
  Anchor, Antenna, Atom, Battery, Beaker, Bell, Bot, Box, Boxes, Briefcase,
  Building2, Camera, Car, CircuitBoard, Cloud, Cog, Compass, Cpu, Database,
  Droplet, Factory, Flame, FlaskConical, Folder, Gauge, Globe, HardDrive,
  Hammer, Headphones, Key, Layers, Leaf, Lightbulb, Magnet, MapPin, Microscope,
  Monitor, Mountain, Package, Plane, Printer, Radar, Radio, Rocket, Ruler,
  Satellite, Server, Shield, Ship, Sprout, Star, Target, Terminal, Thermometer,
  Truck, Users, Watch, Waves, Wifi, Wind, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/** Named so a space stores a stable string, not a component reference. */
export const SPACE_ICONS: Record<string, LucideIcon> = {
  box: Box, boxes: Boxes, package: Package, layers: Layers, folder: Folder,
  rocket: Rocket, satellite: Satellite, radar: Radar, antenna: Antenna, radio: Radio,
  wifi: Wifi, globe: Globe, mapPin: MapPin, compass: Compass, anchor: Anchor,
  cpu: Cpu, circuitBoard: CircuitBoard, server: Server, database: Database,
  hardDrive: HardDrive, terminal: Terminal, monitor: Monitor, camera: Camera,
  zap: Zap, battery: Battery, lightbulb: Lightbulb, flame: Flame, magnet: Magnet,
  wrench: Wrench, hammer: Hammer, cog: Cog, factory: Factory, printer: Printer,
  ruler: Ruler, gauge: Gauge, thermometer: Thermometer,
  flask: FlaskConical, beaker: Beaker, microscope: Microscope, atom: Atom,
  plane: Plane, car: Car, truck: Truck, ship: Ship, bot: Bot,
  shield: Shield, target: Target, key: Key, bell: Bell,
  cloud: Cloud, wind: Wind, droplet: Droplet, waves: Waves, leaf: Leaf,
  sprout: Sprout, mountain: Mountain,
  building: Building2, briefcase: Briefcase, users: Users, star: Star,
  headphones: Headphones, watch: Watch,
};

export const SPACE_ICON_NAMES = Object.keys(SPACE_ICONS);

export const DEFAULT_SPACE_ICON = "box";

/** A space's logo. Falls back to the default rather than rendering nothing. */
export function SpaceIcon({
  name,
  color,
  className = "h-3.5 w-3.5",
  strokeWidth = 1.8,
}: {
  name?: string | null;
  color?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = SPACE_ICONS[name || ""] || SPACE_ICONS[DEFAULT_SPACE_ICON];
  return <Icon className={className} strokeWidth={strokeWidth} style={color ? { color } : undefined} />;
}

/** Grid picker used by the space create/edit modals. */
export function SpaceIconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color?: string | null;
  onChange: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = query.trim()
    ? SPACE_ICON_NAMES.filter((n) => n.toLowerCase().includes(query.trim().toLowerCase()))
    : SPACE_ICON_NAMES;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--input)]">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search icons"
        className="w-full border-b border-[var(--line)] bg-transparent px-3 py-2 text-xs text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none"
      />
      <div className="grid max-h-[168px] grid-cols-8 gap-1 overflow-y-auto p-2">
        {shown.map((name) => {
          const Icon = SPACE_ICONS[name];
          const active = value === name;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(name)}
              className={`flex aspect-square items-center justify-center rounded-md transition ${
                active
                  ? "bg-[var(--tint-strong)] ring-1 ring-[var(--line-strong)]"
                  : "text-[var(--txt-3)] hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
              }`}
              style={active && color ? { color } : undefined}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </button>
          );
        })}
        {shown.length === 0 && (
          <p className="col-span-8 px-1 py-3 text-center text-[11px] text-[var(--txt-3)]">
            No icon matches “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
