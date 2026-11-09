import config from '@payload-config';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import type { ServerFunctionClient } from 'payload';
import '@payloadcms/next/css';
import React from 'react';
import { importMap } from './cms/importMap.js';
import './custom.scss';

type PayloadLayoutProps = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function serverFunction(
  args
) {
  'use server';
  const result = await handleServerFunctions({
    ...args,
    config,
    importMap,
  });
  return result;
};

/**
 * Payload admin root layout (outside `[locale]`).
 *
 * @param props - Layout props
 * @param props.children - Payload admin route segments
 * @returns Payload RootLayout shell
 */
export default function PayloadLayout(props: PayloadLayoutProps) {
  return (
    <RootLayout
      config={config}
      importMap={importMap}
      serverFunction={serverFunction}
    >
      {props.children}
    </RootLayout>
  );
}
