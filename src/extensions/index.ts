import type { ComponentType } from "react";
import { Boxes } from "lucide-react";
import { SPACE_ICONS } from "@/components/workspace/SpaceIcon";
import manifest from "./manifest.json";
export const extensions = manifest.map(entry => ({ ...entry, to: null, icon: SPACE_ICONS[entry.icon] || Boxes }));
/** Trusted, bundled React panels only. Add an import and map its manifest slug here. */
export const extensionPanels: Record<string, ComponentType> = {};
