"use client";

import { memo } from "react";
import { Streamdown, defaultRehypePlugins, type Components } from "streamdown";
import { cjk } from "@streamdown/cjk";

const plugins = {cjk};
// Keep sanitization and URL hardening, without interpreting raw model HTML.
const rehypePlugins = [defaultRehypePlugins.sanitize, defaultRehypePlugins.harden];
const disallowedElements = ["img"];
const linkSafety = {enabled: false};
const components = {strong: "strong"} satisfies Components;

export const AssistantMarkdown = memo(function AssistantMarkdown({text, streaming = false}: {text: string; streaming?: boolean}) {
  return <Streamdown
    className="assistant-markdown"
    plugins={plugins}
    components={components}
    rehypePlugins={rehypePlugins}
    skipHtml
    disallowedElements={disallowedElements}
    controls={false}
    linkSafety={linkSafety}
    isAnimating={streaming}
  >{text}</Streamdown>;
});
