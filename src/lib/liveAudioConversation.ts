/**
 * Live voice session with the same mic → worklet → send / receive → PCM playback pipeline as
 * Firebase {@link startAudioConversation}, plus transcription callbacks (input/output).
 *
 * The stock helper consumes {@link LiveSession.receive}, so transcripts cannot be read in parallel.
 * This module duplicates that runner and forwards {@link LiveServerContent.inputTranscription} /
 * {@link LiveServerContent.outputTranscription} when enabled on the model config.
 *
 * @license Derived structure from @firebase/ai AudioConversationRunner (Apache-2.0).
 */
import {
  AIError,
  AIErrorCode,
  type LiveSession,
  type StartAudioConversationOptions,
} from "firebase/ai"

const SERVER_INPUT_SAMPLE_RATE = 16000
const SERVER_OUTPUT_SAMPLE_RATE = 24000
const AUDIO_PROCESSOR_NAME = "audio-processor"

const audioProcessorWorkletString = `
  class AudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      this.targetSampleRate = options.processorOptions.targetSampleRate;
      this.inputSampleRate = sampleRate;
    }

    process(inputs) {
      const input = inputs[0];
      if (input && input.length > 0 && input[0].length > 0) {
        const pcmData = input[0];
        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) {
          const sample = pcmData[i];
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / pcmData.length);

        const resampled = new Float32Array(Math.round(pcmData.length * this.targetSampleRate / this.inputSampleRate));
        const ratio = pcmData.length / resampled.length;
        for (let i = 0; i < resampled.length; i++) {
          resampled[i] = pcmData[Math.floor(i * ratio)];
        }

        const resampledInt16 = new Int16Array(resampled.length);
        for (let i = 0; i < resampled.length; i++) {
          const sample = Math.max(-1, Math.min(1, resampled[i]));
          if (sample < 0) {
            resampledInt16[i] = sample * 32768;
          } else {
            resampledInt16[i] = sample * 32767;
          }
        }

        this.port.postMessage({ pcm16: resampledInt16, rms });
      }
      return true;
    }
  }

  registerProcessor('${AUDIO_PROCESSOR_NAME}', AudioProcessor);
`

export type TranscriptAudioConversationOptions = StartAudioConversationOptions & {
  onInputTranscription?: (text: string) => void
  onOutputTranscription?: (text: string) => void
  /** RMS levels 0–1 from the same graph as capture/playback (no second mic). */
  onAudioLevels?: (levels: { input: number; output: number }) => void
}

type AudioConversationDeps = {
  audioContext: AudioContext
  mediaStream: MediaStream
  sourceNode: MediaStreamAudioSourceNode
  workletNode: AudioWorkletNode
  inputAnalyser: AnalyserNode
  outputAnalyser: AnalyserNode
  keepAliveGain: GainNode
}

function clampLevel(n: number) {
  return Math.min(1, Math.max(0, n))
}

function normalizeRms(rms: number) {
  // Voice-call meter tuning: make normal speech visibly lively with low latency.
  const floor = 0.0015
  const ceiling = 0.05
  const normalized = clampLevel((rms - floor) / (ceiling - floor))
  return Math.pow(normalized, 0.5)
}

function rmsFromPcm16(pcm16: Int16Array): number {
  if (pcm16.length === 0) return 0
  let sum = 0
  for (let i = 0; i < pcm16.length; i++) {
    const sample = pcm16[i] / 32768
    sum += sample * sample
  }
  return Math.sqrt(sum / pcm16.length)
}

function rmsFromTimeDomain(analyser: AnalyserNode, buf: Float32Array): number {
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const sample = buf[i]
    sum += sample * sample
  }
  return Math.sqrt(sum / buf.length)
}

function smoothMeter(current: number, target: number) {
  const attack = 0.62
  const release = 0.22
  const mix = target > current ? attack : release
  return current + (target - current) * mix
}

class TranscriptAudioConversationRunner {
  private readonly liveSession: LiveSession
  private readonly options: TranscriptAudioConversationOptions
  private readonly deps: AudioConversationDeps
  private isStopped = false
  private readonly stopPromise: Promise<void>
  private resolveStop!: () => void
  private readonly playbackQueue: ArrayBuffer[] = []
  private readonly scheduledSources: AudioBufferSourceNode[] = []
  private nextStartTime = 0
  private isPlaybackLoopRunning = false
  private receiveLoopPromise: Promise<void>
  private rafId = 0
  private readonly inputTimeBuf: Float32Array
  private readonly outputTimeBuf: Float32Array
  private inputSmooth = 0
  private outputSmooth = 0
  private inputWorkletRms = 0
  private lastInputAtMs = 0

  constructor(liveSession: LiveSession, options: TranscriptAudioConversationOptions, deps: AudioConversationDeps) {
    this.liveSession = liveSession
    this.options = options
    this.deps = deps
    this.inputTimeBuf = new Float32Array(deps.inputAnalyser.fftSize)
    this.outputTimeBuf = new Float32Array(deps.outputAnalyser.fftSize)
    this.stopPromise = new Promise<void>((resolve) => {
      this.resolveStop = resolve
    })
    this.liveSession.inConversation = true
    this.receiveLoopPromise = this.runReceiveLoop().finally(() => this.cleanup())

    if (this.options.onAudioLevels) {
      const tick = () => {
        if (this.isStopped) return
        const nowMs = performance.now()
        const inputAnalyserLevel = normalizeRms(rmsFromTimeDomain(this.deps.inputAnalyser, this.inputTimeBuf))
        const inputWorkletLevel =
          nowMs - this.lastInputAtMs < 140 ? normalizeRms(this.inputWorkletRms) : 0
        const inLevel = Math.max(inputAnalyserLevel, inputWorkletLevel)
        const outLevel = normalizeRms(rmsFromTimeDomain(this.deps.outputAnalyser, this.outputTimeBuf))
        this.inputSmooth = smoothMeter(this.inputSmooth, inLevel)
        this.outputSmooth = smoothMeter(this.outputSmooth, outLevel)
        if (this.inputSmooth < 0.01) this.inputSmooth = 0
        if (this.outputSmooth < 0.01) this.outputSmooth = 0
        this.options.onAudioLevels?.({ input: this.inputSmooth, output: this.outputSmooth })
        this.rafId = requestAnimationFrame(tick)
      }
      this.rafId = requestAnimationFrame(tick)
    }

    this.deps.workletNode.port.onmessage = (event: MessageEvent) => {
      if (this.isStopped) return
      const { pcm16, rms } = event.data as { pcm16: Int16Array; rms: number }
      this.inputWorkletRms = rms
      this.lastInputAtMs = performance.now()
      const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(new Uint8Array(pcm16.buffer)) as unknown as number[]),
      )
      void this.liveSession.sendAudioRealtime({
        mimeType: "audio/pcm",
        data: base64,
      })
    }
  }

  async stop(): Promise<void> {
    if (this.isStopped) return
    this.isStopped = true
    this.resolveStop()
    await this.receiveLoopPromise
  }

  private cleanup(): void {
    cancelAnimationFrame(this.rafId)
    this.interruptPlayback()
    this.deps.workletNode.port.onmessage = null
    this.deps.workletNode.disconnect()
    this.deps.sourceNode.disconnect()
    this.deps.inputAnalyser.disconnect()
    this.deps.outputAnalyser.disconnect()
    this.deps.keepAliveGain.disconnect()
    this.deps.mediaStream.getTracks().forEach((track) => track.stop())
    if (this.deps.audioContext.state !== "closed") {
      void this.deps.audioContext.close()
    }
    this.liveSession.inConversation = false
  }

  private enqueueAndPlay(audioData: ArrayBuffer): void {
    this.playbackQueue.push(audioData)
    void this.processPlaybackQueue()
  }

  private interruptPlayback(): void {
    for (const source of [...this.scheduledSources]) {
      source.stop(0)
    }
    this.playbackQueue.length = 0
    this.nextStartTime = this.deps.audioContext.currentTime
  }

  private async processPlaybackQueue(): Promise<void> {
    if (this.isPlaybackLoopRunning) return
    this.isPlaybackLoopRunning = true
    while (this.playbackQueue.length > 0 && !this.isStopped) {
      const pcmRawBuffer = this.playbackQueue.shift()
      if (!pcmRawBuffer) break
      try {
        const pcm16 = new Int16Array(pcmRawBuffer)
        const frameCount = pcm16.length
        const audioBuffer = this.deps.audioContext.createBuffer(1, frameCount, SERVER_OUTPUT_SAMPLE_RATE)
        const channelData = audioBuffer.getChannelData(0)
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = pcm16[i] / 32768
        }
        const source = this.deps.audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(this.deps.outputAnalyser)
        this.scheduledSources.push(source)
        source.onended = () => {
          const idx = this.scheduledSources.indexOf(source)
          if (idx >= 0) this.scheduledSources.splice(idx, 1)
        }
        this.nextStartTime = Math.max(this.deps.audioContext.currentTime, this.nextStartTime)
        source.start(this.nextStartTime)
        this.nextStartTime += audioBuffer.duration
      } catch {
        // ignore decode/schedule errors
      }
    }
    this.isPlaybackLoopRunning = false
  }

  private async runReceiveLoop(): Promise<void> {
    const messageGenerator = this.liveSession.receive()
    while (!this.isStopped) {
      const result = await Promise.race([
        messageGenerator.next(),
        this.stopPromise.then(() => ({ done: true as const, value: undefined })),
      ])
      if (this.isStopped || result.done) break

      const message = result.value
      if (!message) break

      if (message.type === "serverContent") {
        const serverContent = message
        if (serverContent.interrupted) {
          this.interruptPlayback()
        }
        const inputText = serverContent.inputTranscription?.text
        if (inputText) {
          this.options.onInputTranscription?.(inputText)
        }
        const outputText = serverContent.outputTranscription?.text
        if (outputText) {
          this.options.onOutputTranscription?.(outputText)
        }
        const audioPart = serverContent.modelTurn?.parts.find((part) =>
          part.inlineData?.mimeType?.startsWith("audio/"),
        )
        if (audioPart?.inlineData?.data) {
          const audioData = Uint8Array.from(atob(audioPart.inlineData.data), (c) => c.charCodeAt(0)).buffer
          this.enqueueAndPlay(audioData)
        }
      } else if (message.type === "toolCall") {
        const handler = this.options.functionCallingHandler
        if (!handler) {
          /* tool calls ignored */
        } else {
          try {
            const functionResponse = await handler(message.functionCalls)
            if (!this.isStopped) {
              void this.liveSession.sendFunctionResponses([functionResponse])
            }
          } catch (e) {
            throw new AIError(
              AIErrorCode.ERROR,
              `Function calling handler failed: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      }
    }
  }
}

/**
 * Same behavior as {@link startAudioConversation}, plus optional transcription callbacks.
 * Enable {@link LiveGenerationConfig.inputAudioTranscription} / {@link LiveGenerationConfig.outputAudioTranscription} on the live model.
 */
export async function startAudioConversationWithTranscripts(
  liveSession: LiveSession,
  options: TranscriptAudioConversationOptions = {},
): Promise<{ stop: () => Promise<void> }> {
  if (liveSession.isClosed) {
    throw new AIError(AIErrorCode.SESSION_CLOSED, "Cannot start audio conversation on a closed LiveSession.")
  }
  if (liveSession.inConversation) {
    throw new AIError(AIErrorCode.REQUEST_ERROR, "An audio conversation is already in progress for this session.")
  }
  if (
    typeof AudioWorkletNode === "undefined" ||
    typeof AudioContext === "undefined" ||
    typeof navigator === "undefined" ||
    !navigator.mediaDevices
  ) {
    throw new AIError(
      AIErrorCode.UNSUPPORTED,
      "Audio conversation is not supported in this environment. It requires the Web Audio API and AudioWorklet support.",
    )
  }

  let audioContext: AudioContext | undefined
  try {
    audioContext = new AudioContext()
    if (audioContext.state === "suspended") {
      await audioContext.resume()
    }
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const workletBlob = new Blob([audioProcessorWorkletString], { type: "application/javascript" })
    const workletURL = URL.createObjectURL(workletBlob)
    await audioContext.audioWorklet.addModule(workletURL)
    URL.revokeObjectURL(workletURL)

    const sourceNode = audioContext.createMediaStreamSource(mediaStream)
    const workletNode = new AudioWorkletNode(audioContext, AUDIO_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
      outputChannelCount: [1],
      processorOptions: { targetSampleRate: SERVER_INPUT_SAMPLE_RATE },
    })
    sourceNode.connect(workletNode)

    const inputAnalyser = audioContext.createAnalyser()
    inputAnalyser.fftSize = 512
    inputAnalyser.smoothingTimeConstant = 0.12
    sourceNode.connect(inputAnalyser)

    const outputAnalyser = audioContext.createAnalyser()
    outputAnalyser.fftSize = 512
    outputAnalyser.smoothingTimeConstant = 0.12
    outputAnalyser.connect(audioContext.destination)

    // Keep the capture/worklet branch rendered without ever feeding the mic back to speakers.
    const keepAliveGain = audioContext.createGain()
    keepAliveGain.gain.value = 0
    inputAnalyser.connect(keepAliveGain)
    workletNode.connect(keepAliveGain)
    keepAliveGain.connect(audioContext.destination)

    const runner = new TranscriptAudioConversationRunner(liveSession, options, {
      audioContext,
      mediaStream,
      sourceNode,
      workletNode,
      inputAnalyser,
      outputAnalyser,
      keepAliveGain,
    })
    return { stop: () => runner.stop() }
  } catch (e) {
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close()
    }
    if (e instanceof AIError || e instanceof DOMException) {
      throw e
    }
    throw new AIError(
      AIErrorCode.ERROR,
      `Failed to initialize audio recording: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}
