"use client";

import { useServerInsertedHTML } from "next/navigation";
import { StyleProvider, createCache, extractStyle } from "@ant-design/cssinjs";
import { useRef } from "react";

/**
 * AntdStyleRegistry — extracts Ant Design's CSS-in-JS styles during SSR
 * and injects them into the <head> before the client hydrates.
 *
 * This eliminates the FOUC (flash of unstyled content) that occurs when
 * antd styles are only applied client-side.
 *
 * Required for: antd v5+, @ant-design/x, Next.js App Router
 * Docs: https://ant.design/docs/react/use-with-next#using-app-router
 */
export function AntdStyleRegistry({ children }: { children: React.ReactNode }) {
  const cache = useRef(createCache());

  useServerInsertedHTML(() => {
    // Extract all antd CSS-in-JS styles accumulated so far and inject as <style>
    const styleText = extractStyle(cache.current, true);
    return (
      <style
        id="antd-ssr-styles"
        dangerouslySetInnerHTML={{ __html: styleText }}
      />
    );
  });

  return (
    <StyleProvider cache={cache.current}>
      {children}
    </StyleProvider>
  );
}
