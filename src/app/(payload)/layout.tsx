/* Based on the file Payload generates; edited only to pass the admin font through htmlProps. */
import config from '@payload-config';
import '@payloadcms/next/css';
import type { ServerFunctionClient } from 'payload';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import React from 'react';

import { Vazirmatn } from '@/lib/fonts';
import { importMap } from './admin/importMap.js';
import './custom.scss';

type Args = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  'use server';
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

// Do not pass dir or lang in htmlProps: they would override Payload's language detection.
const Layout = ({ children }: Args) => (
  <RootLayout
    config={config}
    htmlProps={{ className: Vazirmatn.variable }}
    importMap={importMap}
    serverFunction={serverFunction}
  >
    {children}
  </RootLayout>
);

export default Layout;
