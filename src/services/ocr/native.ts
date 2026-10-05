import { registerPlugin } from '@capacitor/core';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { platform } from '../platform';
import type { PickedPhoto } from '../photo';
import type { OcrService } from './types';
import { WebOcr } from './web';
import { toFileUri } from '../../lib/fileUri';

/**
 * iOS: our own plugin on Apple's Vision framework (ios/App/App/OcrPlugin.swift),
 * because the ML Kit SDK does not support Swift Package Manager.
 */
interface VisionOcrPlugin {
  recognize(options: { path: string; language: string }): Promise<{ text: string }>;
}
const VisionOcr = registerPlugin<VisionOcrPlugin>('MappeoraOcr');

/**
 * Android: Google ML Kit; iOS: Apple Vision. Both run on the device, offline.
 * If the native engine fails for any reason, we fall back to Tesseract.js
 * (the web engine), which also runs inside the app's WebView.
 */
export class NativeOcr implements OcrService {
  private fallback: WebOcr | undefined;

  async recognize(photo: PickedPhoto, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<string> {
    try {
      if (!photo.uri) throw new Error('missing-file');
      const path = toFileUri(photo.uri);
      if (platform() === 'ios') {
        return (await VisionOcr.recognize({ path, language: 'it-IT' })).text;
      }
      return (await TextRecognition.processImage({ path })).text;
    } catch (e) {
      if (signal?.aborted) throw signal.reason;
      console.warn('OCR nativo non riuscito, uso Tesseract:', e);
      this.fallback ??= new WebOcr();
      return this.fallback.recognize(photo, onProgress, signal);
    }
  }
}
