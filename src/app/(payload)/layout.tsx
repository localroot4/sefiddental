/* Based on the file Payload generates; edited to pass the admin font through htmlProps and to
   replace the schedule-publish server function (src/admin/schedulePublish.ts). */
import config from '@payload-config';
import '@payloadcms/next/css';
import type { ServerFunctionClient } from 'payload';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import React from 'react';

import { adminServerFunctions } from '@/admin/schedulePublish';
import { Vazirmatn } from '@/lib/fonts';
// A static import path cannot use ADMIN_ROUTE (src/lib/paths.ts); the folder name follows it.
import { importMap } from './giris/importMap.js';
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
    serverFunctions: adminServerFunctions,
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
