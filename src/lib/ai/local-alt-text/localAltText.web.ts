import {loadModelImage} from './image'
import {buildLocalAltTextPrompt} from './prompt'
import {type WorkerGenerateRequest, type WorkerResponse} from './protocol'
import {
  finalizeLocalAltText,
  type GenerateLocalAltTextOptions,
  type LocalAltTextProgress,
} from './shared'

/** Built by `scripts/build-local-alt-text.mjs`; see `scripts/README.md`. */
const WORKER_URL = '/static/local-alt-text/worker.js'

type Pending = {
  resolve: (text: string) => void
  reject: (error: Error) => void
  onProgress?: (progress: LocalAltTextProgress) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function failAll(error: Error) {
  for (const [id, entry] of pending) {
    pending.delete(id)
    entry.reject(error)
  }
}

function getWorker() {
  if (worker) return worker

  const next = new Worker(WORKER_URL, {type: 'module'})

  next.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    const entry = pending.get(message.id)
    if (!entry) return

    switch (message.type) {
      case 'progress':
        entry.onProgress?.({stage: message.stage, progress: message.progress})
        return
      case 'result':
        pending.delete(message.id)
        entry.resolve(message.text)
        return
      case 'error':
        pending.delete(message.id)
        entry.reject(new Error(message.message))
        return
    }
  }

  // Fatal worker failure (uncaught exception, script load failure). The model
  // and its cache live in the worker, so it has to be replaced wholesale.
  next.onerror = event => {
    failAll(new Error(event.message || 'The on-device model failed to load'))
    next.terminate()
    if (worker === next) worker = null
  }

  worker = next
  return next
}

/**
 * Generates alt text in a worker. The image is decoded on the main thread and
 * handed over as raw RGBA, so the worker never touches the network for it.
 */
export async function generateLocalAltText({
  uri,
  width,
  height,
  languages,
  onProgress,
}: GenerateLocalAltTextOptions): Promise<string> {
  const image = await loadModelImage(uri, width, height)
  const id = nextId++

  const request: WorkerGenerateRequest = {
    id,
    type: 'generate',
    prompt: buildLocalAltTextPrompt(languages),
    width: image.width,
    height: image.height,
    data: image.data,
  }

  const text = await new Promise<string>((resolve, reject) => {
    pending.set(id, {resolve, reject, onProgress})
    getWorker().postMessage(request, [image.data.buffer])
  })

  return finalizeLocalAltText(text)
}
