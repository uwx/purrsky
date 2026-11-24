import {
  AutoModelForImageTextToText,
  AutoProcessor,
  type ProgressInfo,
  RawImage,
  type Tensor,
} from '@huggingface/transformers'

import {
  type LocalAltTextStage,
  type WorkerGenerateRequest,
  type WorkerResponse,
} from './protocol'

/*
 * Bundled into `public/static/local-alt-text/worker.js` by
 * `scripts/build-local-alt-text.mjs`. Nothing in the app imports this module:
 * Metro cannot bundle the ESM transformers build, so the worker is built
 * separately and loaded by URL.
 */

const MODEL_ID = 'onnx-community/LFM2.5-VL-450M-ONNX'
const MAX_NEW_TOKENS = 96

/**
 * Inferred from the library: its declarations do not re-export `Processor` or
 * `PreTrainedModel` from the package root.
 */
type LoadedPipeline = {
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
  model: Awaited<ReturnType<typeof AutoModelForImageTextToText.from_pretrained>>
}

type GpuAdapter = {features: {has: (name: string) => boolean}}
type GpuNavigator = {gpu?: {requestAdapter: () => Promise<GpuAdapter | null>}}

/** `Processor._call` is typed `any`; this is the part the worker relies on. */
type ProcessorResult = {
  input_ids: Tensor
  [key: string]: unknown
}

type WorkerScope = {
  postMessage: (message: WorkerResponse) => void
  onmessage: ((event: {data: WorkerGenerateRequest}) => void) | null
}

const scope = globalThis as unknown as WorkerScope

const Q4_DTYPE = 'q4' as const
const Q4F16_DTYPE = {
  decoder_model_merged: 'q4f16',
  vision_encoder: 'q4f16',
  embed_tokens: 'q4',
} as const

/** Requests that are still waiting for a reply; progress is broadcast to them. */
const waiting = new Set<number>()

function postProgress(
  id: number | null,
  stage: LocalAltTextStage,
  progress?: number,
) {
  const ids = id === null ? waiting : [id]
  for (const target of ids) {
    scope.postMessage({id: target, type: 'progress', stage, progress})
  }
}

const broadcast = (stage: LocalAltTextStage, progress?: number) =>
  postProgress(null, stage, progress)

/**
 * Download progress arrives once per chunk; only whole percent changes are
 * forwarded so the dialog does not re-render thousands of times.
 */
let lastPercent = -1

function reportDownload(progress: number) {
  const percent = Math.floor(progress * 100)
  if (percent === lastPercent) return
  lastPercent = percent
  broadcast('download', percent / 100)
}

/**
 * WebGPU when it is actually usable. `shader-f16` decides the dtype because
 * fp16 kernels fail to compile without it.
 */
async function pickDevice() {
  const gpu = (navigator as unknown as GpuNavigator).gpu
  if (!gpu) return {device: 'wasm' as const, dtype: Q4_DTYPE}

  try {
    const adapter = await gpu.requestAdapter()
    if (!adapter) return {device: 'wasm' as const, dtype: Q4_DTYPE}
    return {
      device: 'webgpu' as const,
      dtype: adapter.features.has('shader-f16') ? Q4F16_DTYPE : Q4_DTYPE,
    }
  } catch {
    return {device: 'wasm' as const, dtype: Q4_DTYPE}
  }
}

let pipelinePromise: Promise<LoadedPipeline> | null = null

function loadPipeline() {
  pipelinePromise ??= (async () => {
    const {device, dtype} = await pickDevice()

    broadcast('load')
    const processor = await AutoProcessor.from_pretrained(MODEL_ID)

    const model = await AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
      device,
      dtype,
      progress_callback: (info: ProgressInfo) => {
        if (info.status === 'progress_total') {
          reportDownload(info.progress / 100)
        }
      },
    })

    return {processor, model}
  })().catch(error => {
    // A failed load must not poison the next attempt.
    pipelinePromise = null
    throw error
  })

  return pipelinePromise
}

async function generate({
  id,
  prompt,
  width,
  height,
  data,
}: WorkerGenerateRequest) {
  const {processor, model} = await loadPipeline()

  const image = new RawImage(data, width, height, 4)
  const chat = processor.apply_chat_template(
    [
      {
        role: 'user',
        content: [{type: 'image'}, {type: 'text', text: prompt}],
      },
    ],
    {add_generation_prompt: true},
  )

  const inputs = (await processor(image, chat, {
    add_special_tokens: false,
  })) as ProcessorResult
  const promptLength = Number(inputs.input_ids.dims[1])

  postProgress(id, 'generate')

  const output = (await model.generate({
    ...inputs,
    do_sample: false,
    repetition_penalty: 1.05,
    max_new_tokens: MAX_NEW_TOKENS,
  })) as Tensor

  const [text] = processor.batch_decode(
    output.slice(null, [promptLength, Number(output.dims[1])]),
    {skip_special_tokens: true},
  )

  return text ?? ''
}

/*
 * One generation at a time. The model instance is shared, and its sessions are
 * not reentrant.
 */
let queue: Promise<unknown> = Promise.resolve()

scope.onmessage = event => {
  const request = event.data
  if (request?.type !== 'generate') return

  waiting.add(request.id)
  queue = queue.then(async () => {
    try {
      const text = await generate(request)
      scope.postMessage({id: request.id, type: 'result', text})
    } catch (error) {
      scope.postMessage({
        id: request.id,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      waiting.delete(request.id)
    }
  })
}
