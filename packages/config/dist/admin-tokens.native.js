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
var admin_tokens_exports = {};
__export(admin_tokens_exports, {
  adminTokens: () => adminTokens,
  adminVariants: () => adminVariants,
  getAdminSpacing: () => getAdminSpacing
});
module.exports = __toCommonJS(admin_tokens_exports);
var adminTokens = {
  // Spacing tokens - more condensed than standard themes
  spacing: {
    xs: "$1",
    // 4px - Very tight spacing
    sm: "$2",
    // 8px - Standard admin spacing
    md: "$3",
    // 12px - Medium admin spacing
    lg: "$4",
    // 16px - Large admin spacing
    xl: "$5"
  },
  // 20px - Extra large (used sparingly)
  // Component-specific spacing
  form: {
    sectionPadding: "$3",
    // Padding for form sections
    itemSpacing: "$2",
    // Space between form items
    fieldSpacing: "$2",
    // Space between form fields
    groupSpacing: "$2"
  },
  // Space between field groups
  card: {
    padding: "$3",
    // Card padding
    spacing: "$2",
    // Space between card elements
    nestedPadding: "$3"
  },
  // Padding for nested cards
  list: {
    itemSpacing: "$1",
    // Space between list items
    itemPadding: "$2",
    // Padding within list items
    groupSpacing: "$3"
  },
  // Space between list groups
  // Typography tokens for admin interfaces
  typography: {
    sizes: {
      xs: "$2",
      // 12px - Very small text
      sm: "$3",
      // 14px - Small text
      md: "$4",
      // 16px - Body text
      lg: "$5",
      // 18px - Large text
      xl: "$6",
      // 20px - Section headers
      xxl: "$7"
    },
    // 24px - Page headers
    weights: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700"
    }
  },
  // Interactive element sizing
  interactive: {
    buttonSizeSmall: "$2",
    // Small buttons
    buttonSizeMedium: "$3",
    // Medium buttons
    buttonSizeLarge: "$4",
    // Large buttons
    iconSize: "$1",
    // Standard icon size
    iconSizeSmall: "$0.75"
  },
  // Small icon size
  // Layout tokens
  layout: {
    maxWidth: 1e3,
    // Max container width
    sidebarWidth: 240,
    // Sidebar width
    headerHeight: 64,
    // Header height
    contentPadding: "$4"
  }
}, adminVariants = {
  // Form sections with condensed spacing
  formSection: {
    padding: adminTokens.form.sectionPadding,
    space: adminTokens.form.itemSpacing
  },
  // Dense cards for admin interfaces
  adminCard: {
    padding: adminTokens.card.padding,
    space: adminTokens.card.spacing
  },
  // Compact lists
  adminList: {
    space: adminTokens.list.itemSpacing,
    padding: adminTokens.list.itemPadding
  }
}, getAdminSpacing = function(isAdminTheme) {
  return {
    sectionPadding: isAdminTheme ? adminTokens.form.sectionPadding : "$4",
    itemSpacing: isAdminTheme ? adminTokens.form.itemSpacing : "$4",
    cardPadding: isAdminTheme ? adminTokens.card.padding : "$4",
    cardSpacing: isAdminTheme ? adminTokens.card.spacing : "$4"
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adminTokens,
  adminVariants,
  getAdminSpacing
});
//# sourceMappingURL=admin-tokens.js.map
