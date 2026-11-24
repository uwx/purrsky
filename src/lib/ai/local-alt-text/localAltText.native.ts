import {type LLMChatSession} from 'react-native-executorch'
import {type ImageBuffer} from 'react-native-executorch/cv'

import {loadModelImage} from './image'
import {buildLocalAltTextPrompt} from './prompt'
import {
  finalizeLocalAltText,
  type GenerateLocalAltTextOptions,
  type LocalAltTextProgress,
} from './shared'

/** The model is ~650 MB; the session is kept alive across generations. */
let sessionPromise: Promise<LLMChatSession> | null = null
const downloadListeners = new Set<(progress: number) => void>()

function reportDownload(progress: number) {
  for (const listener of downloadListeners) listener(progress)
}

function createSession() {
  sessionPromise ??= (async () => {
    /*
     * Imported lazily: the package backs onto a native module that only exists
     * after a native rebuild, and importing it eagerly would break the composer
     * for anyone still on an older dev client.
     */
    const {createLLMChatSession, download, models} =
      await import('react-native-executorch')
    const localModel = await download(models.llm.LFM2_5_VL_450M.DEFAULT, {
      onProgress: reportDownload,
    })
    return createLLMChatSession(localModel, {
      generationConfig: {
        maxNewTokens: 96,
        temperature: 0.2,
        repetitionPenalty: 1.05,
      },
      stopRegex: /\n\s*\n/,
      resetOnTurn: true,
    })
  })().catch(error => {
    // A failed download or load must not poison the next attempt.
    sessionPromise = null
    throw error
  })

  return sessionPromise
}

async function ensureSession(
  onProgress?: (progress: LocalAltTextProgress) => void,
) {
  if (sessionPromise) return sessionPromise

  // The downloader reports per chunk; only whole percent steps are forwarded.
  let lastPercent = -1
  const listener = (progress: number) => {
    const percent = Math.floor(progress * 100)
    if (percent === lastPercent) return
    lastPercent = percent
    onProgress?.({stage: 'download', progress: percent / 100})
  }
  downloadListeners.add(listener)
  try {
    return await createSession()
  } finally {
    downloadListeners.delete(listener)
  }
}

/*
 * One generation at a time: two sessions would hold two copies of the weights,
 * and the chat session rejects a concurrent turn with RESOURCE_BUSY.
 */
let queue: Promise<unknown> = Promise.resolve()

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task)
  queue = result.then(
    () => {},
    () => {},
  )
  return result
}

export async function generateLocalAltText({
  uri,
  width,
  height,
  languages,
  onProgress,
}: GenerateLocalAltTextOptions): Promise<string> {
  return serialize(async () => {
    const session = await ensureSession(onProgress)
    const image = await loadModelImage(uri, width, height)

    const buffer: ImageBuffer = {
      data: image.data,
      width: image.width,
      height: image.height,
      format: 'rgba',
      layout: 'hwc',
    }

    onProgress?.({stage: 'generate'})

    const turn = await session.sendMessage([
      {kind: 'image', image: buffer},
      // The template concatenates parts without separators, so the trailing
      // newline keeps the assistant header off the prompt text.
      `${buildLocalAltTextPrompt(languages)}\n`,
    ])

    const reply = turn.messages[turn.messages.length - 1]?.content
    if (typeof reply !== 'string') {
      throw new Error('The model did not return any alt text')
    }

    return finalizeLocalAltText(reply)
  })
}
