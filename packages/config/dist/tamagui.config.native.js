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
var tamagui_config_exports = {};
__export(tamagui_config_exports, {
  config: () => config,
  default: () => tamagui_config_default
});
module.exports = __toCommonJS(tamagui_config_exports);
var import_tamagui = require("tamagui"), import_font_inter = require("@tamagui/font-inter"), import_shorthands = require("@tamagui/shorthands"), import_v3 = require("@tamagui/config/v3"), import_react_native_media_driver = require("@tamagui/react-native-media-driver"), import_animations = require("@my/ui/src/animations"), import_tee_themes = require("./tee-themes"), headingFont = (0, import_font_inter.createInterFont)({
  size: {
    6: 15
  },
  transform: {
    6: "uppercase",
    7: "none"
  },
  weight: {
    6: "400",
    7: "700"
  },
  color: {
    6: "$colorFocus",
    7: "$color"
  },
  letterSpacing: {
    5: 2,
    6: 1,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    12: 0,
    14: 0,
    15: 0
  },
  face: {
    700: {
      normal: "InterBold"
    }
  }
}), bodyFont = (0, import_font_inter.createInterFont)({
  face: {
    700: {
      normal: "InterBold"
    }
  }
}, {
  sizeSize: function(size) {
    return Math.round(size * 1.1);
  },
  sizeLineHeight: function(size) {
    return Math.round(size * 1.1 + (size > 20, 10));
  }
}), config = (0, import_tamagui.createTamagui)({
  defaultFont: "body",
  animations: import_animations.animations,
  shouldAddPrefersColorThemes: !0,
  themeClassNameOnRoot: !0,
  // highly recommended to turn this on if you are using shorthands
  // to avoid having multiple valid style keys that do the same thing
  // we leave it off by default because it can be confusing as you onboard.
  onlyAllowShorthands: !1,
  shorthands: import_shorthands.shorthands,
  fonts: {
    body: bodyFont,
    heading: headingFont
  },
  settings: {
    allowedStyleValues: "somewhat-strict"
  },
  themes: {
    ...import_v3.themes,
    ...import_tee_themes.teeThemes
  },
  tokens: import_v3.tokens,
  media: (0, import_react_native_media_driver.createMedia)({
    xs: {
      maxWidth: 660
    },
    sm: {
      maxWidth: 800
    },
    md: {
      maxWidth: 1020
    },
    lg: {
      maxWidth: 1280
    },
    xl: {
      maxWidth: 1420
    },
    xxl: {
      maxWidth: 1600
    },
    gtXs: {
      minWidth: 661
    },
    gtSm: {
      minWidth: 801
    },
    gtMd: {
      minWidth: 1021
    },
    gtLg: {
      minWidth: 1281
    },
    short: {
      maxHeight: 820
    },
    tall: {
      minHeight: 820
    },
    hoverNone: {
      hover: "none"
    },
    pointerCoarse: {
      pointer: "coarse"
    }
  })
}), tamagui_config_default = config;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
//# sourceMappingURL=tamagui.config.js.map
