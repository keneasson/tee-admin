/** @type {import('next').NextConfig} */
const { withTamagui } = require('@tamagui/next-plugin')
const { join } = require('path')

const boolVals = {
  true: true,
  false: false,
}

const disableExtraction =
  boolVals[process.env.DISABLE_EXTRACTION] ?? process.env.NODE_ENV === 'development'

const plugins = [
  withTamagui({
    config: '../../packages/config/src/tamagui.config.ts',
    components: ['tamagui', '@my/ui'],
    appDir: true,
    importsWhitelist: ['constants.js', 'colors.js'],
    outputCSS: process.env.NODE_ENV === 'production' ? './public/tamagui.css' : null,
    logTimings: true,
    disableExtraction,
    shouldExtract: (path) => {
      if (path.includes(join('packages', 'app'))) {
        return true
      }
    },
    excludeReactNativeWebExports: ['Switch', 'ProgressBar', 'Picker', 'CheckBox', 'Touchable'],
  }),
]

module.exports = function () {
  /** @type {import('next').NextConfig} */
  let config = {
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    modularizeImports: {
      '@tamagui/lucide-icons': {
        transform: `@tamagui/lucide-icons/icons/{{member}}`,
        skipDefaultConversion: true,
      },
    },
    transpilePackages: [
      'solito',
      'react-native-web',
      'expo-linking',
      'expo-constants',
      'expo-modules-core',
      '@my/app',
      '@my/ui',
      '@my/config',
    ],
    experimental: {
      scrollRestoration: true,
    },
    // Ensure proper static asset serving in development
    assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
    webpack: (config) => {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@my/app': join(__dirname, '../../packages/app'),
        '@my/ui': join(__dirname, '../../packages/ui'),
        '@my/config': join(__dirname, '../../packages/config'),
        '@': join(__dirname, '.'),
        '@/utils': join(__dirname, './utils'),
      }
      return config
    },
    turbopack: {
      rules: {
        '*.ts': ['ts-loader'],
        '*.tsx': ['ts-loader'],
      },
      resolveAlias: {
        '@my/app': '../../packages/app',
        '@my/ui': '../../packages/ui',
        '@my/config': '../../packages/config',
        '@': '.',
        '@/utils': './utils',
      },
    },
  }

  for (const plugin of plugins) {
    config = {
      ...config,
      ...plugin(config),
    }
  }

  return config
}
