// theme.ts
import { vars } from "nativewind";

export interface ThemeFonts {
  heading: {
    family: string;
    weights: Record<string, string>;
  };
  body: {
    family: string;
    weights: Record<string, string>;
  };
  mono: {
    family: string;
    weights: Record<string, string>;
  };
}

// Default theme fonts: Inter for clean, modern typography
export const themeFonts: ThemeFonts = {
  heading: {
    family: 'Inter',
    weights: {
      normal: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
  },
  body: {
    family: 'Inter',
    weights: {
      normal: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
    },
  },
  mono: {
    family: 'JetBrainsMono',
    weights: {
      normal: 'JetBrainsMono_400Regular',
      medium: 'JetBrainsMono_500Medium',
    },
  },
};

// Violet/Lavender Theme - Clean, modern, elegant
export const lightTheme = vars({
  "--radius": "16",

  // Core semantic colors
  "--background": "250 249 255", // Very light lavender
  "--foreground": "30 27 75", // Deep violet text

  "--card": "255 255 255", // White
  "--card-foreground": "30 27 75",

  "--popover": "255 255 255",
  "--popover-foreground": "30 27 75",

  "--primary": "139 92 246", // Violet-500 (#8B5CF6)
  "--primary-foreground": "255 255 255", // White

  "--secondary": "243 232 255", // Light lavender (#F3E8FF)
  "--secondary-foreground": "76 29 149", // Deep violet (#4C1D95)

  "--muted": "245 243 255", // Very pale lavender
  "--muted-foreground": "107 114 128", // Gray

  "--accent": "243 232 255", // Light lavender
  "--accent-foreground": "76 29 149",

  "--destructive": "220 38 38",

  "--border": "237 233 254", // Lavender border (#EDE9FE)
  "--input": "237 233 254",
  "--ring": "139 92 246",

  // Chart colors
  "--chart-1": "139 92 246",
  "--chart-2": "167 139 250",
  "--chart-3": "192 132 252",
  "--chart-4": "216 180 254",
  "--chart-5": "129 140 248",

  // Sidebar colors
  "--sidebar": "250 249 255",
  "--sidebar-foreground": "30 27 75",
  "--sidebar-primary": "139 92 246",
  "--sidebar-primary-foreground": "255 255 255",
  "--sidebar-accent": "243 232 255",
  "--sidebar-accent-foreground": "76 29 149",
  "--sidebar-border": "237 233 254",
  "--sidebar-ring": "139 92 246",
});

export const darkTheme = vars({
  "--radius": "16",

  // Core semantic colors
  "--background": "23 23 35", // Dark violet-gray
  "--foreground": "250 249 255",

  "--card": "31 31 47",
  "--card-foreground": "250 249 255",

  "--popover": "39 39 55",
  "--popover-foreground": "250 249 255",

  "--primary": "167 139 250", // Violet-400 (#A78BFA)
  "--primary-foreground": "23 23 35",

  "--secondary": "39 39 55",
  "--secondary-foreground": "250 249 255",

  "--muted": "39 39 55",
  "--muted-foreground": "161 161 170",

  "--accent": "76 29 149", // Deep violet
  "--accent-foreground": "250 249 255",

  "--destructive": "248 113 113",

  "--border": "39 39 55",
  "--input": "39 39 55",
  "--ring": "167 139 250",

  // Chart colors
  "--chart-1": "167 139 250",
  "--chart-2": "192 132 252",
  "--chart-3": "216 180 254",
  "--chart-4": "139 92 246",
  "--chart-5": "99 102 241",

  // Sidebar colors
  "--sidebar": "23 23 35",
  "--sidebar-foreground": "250 249 255",
  "--sidebar-primary": "167 139 250",
  "--sidebar-primary-foreground": "23 23 35",
  "--sidebar-accent": "39 39 55",
  "--sidebar-accent-foreground": "250 249 255",
  "--sidebar-border": "39 39 55",
  "--sidebar-ring": "167 139 250",
});