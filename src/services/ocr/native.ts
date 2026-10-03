import { registerPlugin } from '@capacitor/core';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { platform } from '../platform';
import type { PickedPhoto } from '../photo';
import type { OcrService } from './types';

/**
 * iOS: our own plugin on Apple's Vision framework (ios/App/App/OcrPlugin.swift),
 * because the ML Kit SDK does not support Swift Package Manager.
 */
interface VisionOcrPlugin {
  recognize(options: { path: string; language: string }): Promise<{ text: string }>;
}
const VisionOcr = registerPlugin<VisionOcrPlugin>('MappeoraOcr');

/** Android: Google ML Kit. Both run on the device, offline. */
export class NativeOcr implements OcrService {
  async recognize(photo: PickedPhoto): Promise<string> {
    if (!photo.uri) throw new Error('missing-file');
    if (platform() === 'ios') {
      return (await VisionOcr.recognize({ path: photo.uri, language: 'it-IT' })).text;
    }
    return (await TextRecognition.processImage({ path: photo.uri })).text;
  }
}
