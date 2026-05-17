import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'DevOps Knowledge Hub',
  tagline: 'Your personal SRE & DevOps study portal',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://jithinpnjm.github.io',
  baseUrl: '/studyguide-staff-engineer/',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  markdown: {
    format: 'detect',
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'DevOps Hub',
      logo: {
        alt: 'DevOps Hub',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'knowledgeSidebar',
          position: 'left',
          label: 'Knowledge Base',
        },
        {
          to: '/discover',
          label: 'Discover',
          position: 'left',
        },
        {
          href: 'http://localhost:3000',
          label: 'Admin UI',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `DevOps Knowledge Hub — Local Knowledge Base • Built with Docusaurus`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'python', 'go', 'hcl'],
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
