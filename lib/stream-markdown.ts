/**
 * Consume a plain-text markdown stream from a fetch Response and flush the
 * accumulated content to an editor only on paragraph boundaries (`\n\n`).
 *
 * Why: TipTap's ProseMirror engine re-parses the full document on each
 * `setContent` call. Flushing mid-paragraph shows incomplete markdown
 * (e.g. `## Requi` renders as a half-formed heading). Waiting for `\n\n`
 * guarantees the flushed buffer contains at least one complete block.
 *
 * Returns the final accumulated markdown.
 */
export async function streamMarkdownToEditor(
  response: Response,
  onFlush: (markdown: string) => void,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body reader')

  const decoder = new TextDecoder()
  let accumulated = ''
  let lastFlushed = ''

  const flush = () => {
    if (accumulated === lastFlushed) return
    lastFlushed = accumulated
    onFlush(accumulated)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    accumulated += decoder.decode(value, { stream: true })
    if (accumulated.includes('\n\n') && accumulated !== lastFlushed) {
      flush()
    }
  }

  // Final flush captures any trailing content after the last `\n\n`,
  // or the whole response if no `\n\n` ever appeared.
  flush()

  return accumulated
}
