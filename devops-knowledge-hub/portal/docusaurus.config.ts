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
  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
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
          to: '/docs/interview-prep',
          label: 'Interview Prep',
          position: 'left',
        },
        {
          to: '/docs/aws-deep-dive',
          label: 'AWS Deep Dive',
          position: 'left',
        },
        {
          href: 'https://github.com/jithinpnjm/studyguide-staff-engineer',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `DevOps Knowledge Hub — SRE & DevOps Study Portal • Built with Docusaurus`,
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
