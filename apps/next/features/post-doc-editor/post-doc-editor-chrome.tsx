'use client'

/**
 * The WEB binding of the shared {@link PostDocChrome}: it supplies the Lexical
 * canvas and nothing else.
 *
 * All of the authoring behaviour — metadata chrome, occasion tags, the PII gate,
 * series indicator, publish validation — lives in `@my/ui` and `@my/app` so it is
 * shared with native. This file is the ONLY place the web-only Lexical dependency
 * meets the editor, which is exactly how thin the platform layer should be.
 */

import { PostDocChrome, type PostDocChromeProps } from '@my/ui'
import { PostDocEditor } from './post-doc-editor'

export type PostDocEditorChromeProps = Omit<PostDocChromeProps, 'renderCanvas'>

export function PostDocEditorChrome(props: PostDocEditorChromeProps) {
  return (
    <PostDocChrome
      {...props}
      renderCanvas={({ canvasKey, initialBlocks, onBlocksChange }) => (
        <PostDocEditor
          key={canvasKey}
          initialBlocks={initialBlocks}
          onBlocksChange={onBlocksChange}
        />
      )}
    />
  )
}
