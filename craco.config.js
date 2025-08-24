/**
 * Configuration CRACO pour optimiser le build de l'application Crunch
 * Améliore les performances de build et de runtime
 */

const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  webpack: {
    // Optimisations de build
    configure: (webpackConfig, { env, paths }) => {
      // Configuration pour la production
      if (env === 'production') {
        // Code Splitting optimisé
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Vendor chunk pour les dépendances
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: 10,
                enforce: true,
              },
              // Firebase chunk séparé
              firebase: {
                test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
                name: 'firebase',
                chunks: 'all',
                priority: 15,
                enforce: true,
              },
              // React chunk séparé
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                name: 'react',
                chunks: 'all',
                priority: 20,
                enforce: true,
              },
              // Framer Motion chunk séparé
              animations: {
                test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
                name: 'animations',
                chunks: 'all',
                priority: 12,
                enforce: true,
              },
              // UI Libraries chunk
              ui: {
                test: /[\\/]node_modules[\\/](react-bootstrap|@heroicons|lucide-react)[\\/]/,
                name: 'ui-libs',
                chunks: 'all',
                priority: 11,
                enforce: true,
              },
              // Composants communs de l'app
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 5,
                reuseExistingChunk: true,
                enforce: true,
              },
            },
          },
          // Minification optimisée
          minimizer: [
            new TerserPlugin({
              terserOptions: {
                compress: {
                  drop_console: true, // Supprimer les console.log en production
                  drop_debugger: true,
                  pure_funcs: ['console.log', 'console.info', 'console.debug'],
                },
                mangle: {
                  safari10: true,
                },
                format: {
                  comments: false,
                },
              },
              extractComments: false,
            }),
          ],
        };

        // Plugins de compression
        webpackConfig.plugins.push(
          // Compression Gzip
          new CompressionPlugin({
            algorithm: 'gzip',
            test: /\.(js|css|html|svg)$/,
            threshold: 8192,
            minRatio: 0.8,
          }),
          // Compression Brotli si disponible
          new CompressionPlugin({
            algorithm: 'brotliCompress',
            test: /\.(js|css|html|svg)$/,
            compressionOptions: {
              level: 11,
            },
            threshold: 8192,
            minRatio: 0.8,
            filename: '[path][base].br',
          })
        );

        // Optimisation des modules
        webpackConfig.resolve = {
          ...webpackConfig.resolve,
          alias: {
            ...webpackConfig.resolve.alias,
            // Alias pour les imports plus courts
            '@': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@pages': path.resolve(__dirname, 'src/pages'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@styles': path.resolve(__dirname, 'src/styles'),
          },
          // Optimisation de la résolution des modules
          modules: [
            path.resolve(__dirname, 'src'),
            'node_modules',
          ],
        };

        // Optimisation des performances de build
        webpackConfig.cache = {
          type: 'filesystem',
          buildDependencies: {
            config: [__filename],
          },
        };
      }

      // Configuration pour le développement (simplifiée pour éviter les blocages)
      if (env === 'development') {
        // Garder les optimisations par défaut de CRA, ne pas surcharger
        webpackConfig.devtool = 'eval-source-map';
      }

      // Optimisations communes
      webpackConfig.module.rules.push(
        // Optimisation des images
        {
          test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8192, // 8KB
            },
          },
          generator: {
            filename: 'static/media/[name].[hash:8][ext]',
          },
        }
      );

      // Ignorer les modules inutiles
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": false,
        "stream": false,
        "buffer": false,
      };

      return webpackConfig;
    },
  },
  
  // Configuration Babel (presets laissés à CRA pour éviter les doublons JSX)
  // Si vous souhaitez optimiser les imports, décommentez le bloc ci-dessous.
  // babel: {
  //   plugins: [
  //     [
  //       'babel-plugin-import',
  //       {
  //         libraryName: 'react-bootstrap',
  //         libraryDirectory: '',
  //         camel2DashComponentName: false,
  //       },
  //       'react-bootstrap',
  //     ],
  //   ],
  // },

  // Configuration ESLint
  eslint: {
    enable: true,
    mode: 'extends',
    configure: {
      rules: {
        // Règles pour les performances
        'react-hooks/exhaustive-deps': 'warn',
        'react/jsx-no-bind': 'warn',
        'react/no-array-index-key': 'warn',
        'react/jsx-key': 'error',
      },
    },
  },

  // Configuration du serveur de développement (minimale)
  devServer: {
    historyApiFallback: true,
  },

  // Configuration des plugins
  plugins: [
    // Plugin pour analyser les bundles
    {
      plugin: {
        overrideWebpackConfig: ({ webpackConfig, cracoConfig, pluginOptions, context: { env, paths } }) => {
          if (env === 'production' && process.env.ANALYZE) {
            const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
            webpackConfig.plugins.push(
              new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                openAnalyzer: false,
                reportFilename: 'bundle-report.html',
              })
            );
          }
          return webpackConfig;
        },
      },
    },
  ],
};