/** Protocol shared by the web worker and its client. No runtime imports. */

/** What the on-device engine is doing right now. */
export type LocalAltTextStage = 'download' | 'load' | 'generate'

export type LocalAltTextProgress = {
  stage: LocalAltTextStage
  /** Download progress in `[0, 1]`. Only meaningful while `stage` is `download`. */
  progress?: number
}

export type WorkerGenerateRequest = {
  id: number
  type: 'generate'
  prompt: string
  width: number
  height: number
  /** RGBA pixels, transferred. */
  data: Uint8Array
}

export type WorkerResponse =
  | {id: number; type: 'progress'; stage: LocalAltTextStage; progress?: number}
  | {id: number; type: 'result'; text: string}
  | {id: number; type: 'error'; message: string}
