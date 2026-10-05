import { isNative } from '../platform';
import type { OcrService } from './types';
import { NativeOcr } from './native';
import { WebOcr } from './web';

export type { OcrService } from './types';
export { OcrDownloadError, PhotoDecodeError } from './types';

let instance: OcrService | undefined;

export function ocr(): OcrService {
  instance ??= isNative() ? new NativeOcr() : new WebOcr();
  return instance;
}
