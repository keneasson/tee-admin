var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
var tee_themes_exports = {};
__export(tee_themes_exports, {
  teeThemes: () => teeThemes
});
module.exports = __toCommonJS(tee_themes_exports);
const brandColors = {
  light: {
    // Primary colors - Deep blue with religious/trustworthy feel
    primary: "#1B365D",
    // Rich navy blue
    primaryForeground: "#FFFFFF",
    // Secondary colors - Warm gold/amber for warmth and tradition
    secondary: "#B8860B",
    // Dark goldenrod
    secondaryForeground: "#FFFFFF",
    // Accent colors - Sage green for peace and growth
    accent: "#6B8E5A",
    // Sage green
    accentForeground: "#FFFFFF",
    // Semantic colors - Enhanced for accessibility
    success: "#2D7D32",
    // Darker green
    successForeground: "#FFFFFF",
    warning: "#E65100",
    // Darker orange
    warningForeground: "#FFFFFF",
    error: "#C62828",
    // Darker red
    errorForeground: "#FFFFFF",
    info: "#1565C0",
    // Darker blue
    infoForeground: "#FFFFFF",
    // Text colors - High contrast hierarchy
    textPrimary: "#1A1A1A",
    // Near black
    textSecondary: "#4A4A4A",
    // Dark gray
    textTertiary: "#6B6B6B",
    // Medium gray
    textDisabled: "#A8A8A8",
    // Light gray
    // Background colors - Warm and welcoming
    background: "#FEFEFE",
    // Off-white
    backgroundSecondary: "#F8F6F0",
    // Warm light gray
    backgroundTertiary: "#F2F0E8",
    // Slightly warmer
    // Surface colors
    surface: "#FFFFFF",
    surfaceSecondary: "#F8F6F0",
    // Border colors
    border: "#D0CFC4",
    // Warm gray border
    borderLight: "#E8E6DD",
    // Very light warm border
    // Interactive colors
    interactive: "#1B365D",
    interactiveHover: "#2A4A73",
    interactivePressed: "#153056",
    interactiveDisabled: "#D0CFC4",
    // Primary interaction states
    primaryHover: "#2A4A73",
    primaryPressed: "#153056"
  },
  dark: {
    // Primary colors - Bright enough for dark mode
    primary: "#4A90E2",
    // Bright blue
    primaryForeground: "#000000",
    // Secondary colors - Warm gold that pops
    secondary: "#FFB000",
    // Bright gold
    secondaryForeground: "#000000",
    // Accent colors - Fresh green
    accent: "#8BC34A",
    // Light green
    accentForeground: "#000000",
    // Semantic colors - Bright and accessible
    success: "#4CAF50",
    // Material green
    successForeground: "#000000",
    warning: "#FF9800",
    // Material orange
    warningForeground: "#000000",
    error: "#F44336",
    // Material red
    errorForeground: "#FFFFFF",
    info: "#2196F3",
    // Material blue
    infoForeground: "#000000",
    // Text colors - Excellent contrast for dark mode
    textPrimary: "#FFFFFF",
    // Pure white
    textSecondary: "#E0E0E0",
    // Light gray
    textTertiary: "#B0B0B0",
    // Medium gray
    textDisabled: "#666666",
    // Darker gray
    // Background colors - Rich and warm dark tones
    background: "#0D1117",
    // Rich dark blue-black
    backgroundSecondary: "#1C2128",
    // Better contrast for striping
    backgroundTertiary: "#21262D",
    // Medium dark
    // Surface colors
    surface: "#161B22",
    surfaceSecondary: "#21262D",
    // Border colors
    border: "#30363D",
    // Subtle gray border
    borderLight: "#21262D",
    // Very subtle
    // Interactive colors
    interactive: "#4A90E2",
    interactiveHover: "#5BA0F2",
    interactivePressed: "#3A80D2",
    interactiveDisabled: "#30363D",
    // Primary interaction states
    primaryHover: "#5BA0F2",
    primaryPressed: "#3A80D2"
  }
}, teeThemes = {
  light: {
    // Base Tamagui theme properties
    background: brandColors.light.background,
    backgroundHover: brandColors.light.backgroundSecondary,
    backgroundPress: brandColors.light.backgroundTertiary,
    backgroundFocus: brandColors.light.backgroundSecondary,
    backgroundStrong: brandColors.light.surface,
    backgroundTransparent: "transparent",
    color: brandColors.light.textPrimary,
    colorHover: "#1A1A1A",
    // Deeper gray for better contrast (8.2:1 contrast)
    colorPress: brandColors.light.textPrimary,
    colorFocus: brandColors.light.textPrimary,
    colorTransparent: "transparent",
    borderColor: brandColors.light.border,
    borderColorHover: brandColors.light.borderLight,
    borderColorPress: brandColors.light.border,
    borderColorFocus: brandColors.light.primary,
    borderContrast: brandColors.light.borderLight,
    // For visual contrast and separation
    placeholderColor: brandColors.light.textTertiary,
    // Brand-specific tokens
    primary: brandColors.light.primary,
    primaryHover: brandColors.light.primaryHover,
    primaryPress: brandColors.light.primaryPressed,
    primaryForeground: brandColors.light.primaryForeground,
    primaryHoverForeground: "#1B365D",
    // Use primary background color as text when hovering over active
    secondary: brandColors.light.secondary,
    secondaryHover: brandColors.light.secondary,
    secondaryPress: brandColors.light.secondary,
    secondaryForeground: brandColors.light.secondaryForeground,
    accent: brandColors.light.accent,
    accentHover: brandColors.light.accent,
    accentPress: brandColors.light.accent,
    accentForeground: brandColors.light.accentForeground,
    success: brandColors.light.success,
    successForeground: brandColors.light.successForeground,
    warning: brandColors.light.warning,
    warningForeground: brandColors.light.warningForeground,
    error: brandColors.light.error,
    errorForeground: brandColors.light.errorForeground,
    info: brandColors.light.info,
    infoForeground: brandColors.light.infoForeground,
    // Text hierarchy
    textPrimary: brandColors.light.textPrimary,
    textSecondary: brandColors.light.textSecondary,
    textTertiary: brandColors.light.textTertiary,
    textDisabled: brandColors.light.textDisabled,
    // Interactive states
    interactive: brandColors.light.interactive,
    interactiveHover: brandColors.light.interactiveHover,
    interactivePress: brandColors.light.interactivePressed,
    interactiveDisabled: brandColors.light.interactiveDisabled,
    // Background tokens for striping
    backgroundSecondary: brandColors.light.backgroundSecondary,
    backgroundTertiary: brandColors.light.backgroundTertiary
  },
  dark: {
    // Base Tamagui theme properties
    background: brandColors.dark.background,
    backgroundHover: brandColors.dark.backgroundSecondary,
    backgroundPress: brandColors.dark.backgroundTertiary,
    backgroundFocus: brandColors.dark.backgroundSecondary,
    backgroundStrong: brandColors.dark.surface,
    backgroundTransparent: "transparent",
    color: brandColors.dark.textPrimary,
    colorHover: "#B8B8B8",
    // Lighter gray for WCAG AAA compliance (7.2:1 contrast on dark bg)
    colorPress: brandColors.dark.textPrimary,
    colorFocus: brandColors.dark.textPrimary,
    colorTransparent: "transparent",
    borderColor: brandColors.dark.border,
    borderColorHover: brandColors.dark.borderLight,
    borderColorPress: brandColors.dark.border,
    borderColorFocus: brandColors.dark.primary,
    borderContrast: brandColors.dark.borderLight,
    // For visual contrast and separation
    placeholderColor: brandColors.dark.textTertiary,
    // Brand-specific tokens
    primary: brandColors.dark.primary,
    primaryHover: brandColors.dark.primaryHover,
    primaryPress: brandColors.dark.primaryPressed,
    primaryForeground: brandColors.dark.primaryForeground,
    primaryHoverForeground: "#4A90E2",
    // Use primary background color as text when hovering over active
    secondary: brandColors.dark.secondary,
    secondaryHover: brandColors.dark.secondary,
    secondaryPress: brandColors.dark.secondary,
    secondaryForeground: brandColors.dark.secondaryForeground,
    accent: brandColors.dark.accent,
    accentHover: brandColors.dark.accent,
    accentPress: brandColors.dark.accent,
    accentForeground: brandColors.dark.accentForeground,
    success: brandColors.dark.success,
    successForeground: brandColors.dark.successForeground,
    warning: brandColors.dark.warning,
    warningForeground: brandColors.dark.warningForeground,
    error: brandColors.dark.error,
    errorForeground: brandColors.dark.errorForeground,
    info: brandColors.dark.info,
    infoForeground: brandColors.dark.infoForeground,
    // Text hierarchy
    textPrimary: brandColors.dark.textPrimary,
    textSecondary: brandColors.dark.textSecondary,
    textTertiary: brandColors.dark.textTertiary,
    textDisabled: brandColors.dark.textDisabled,
    // Interactive states
    interactive: brandColors.dark.interactive,
    interactiveHover: brandColors.dark.interactiveHover,
    interactivePress: brandColors.dark.interactivePressed,
    interactiveDisabled: brandColors.dark.interactiveDisabled,
    // Missing background tokens for striping
    backgroundSecondary: brandColors.dark.backgroundSecondary,
    backgroundTertiary: brandColors.dark.backgroundTertiary
  }
};
//# sourceMappingURL=tee-themes.js.map
