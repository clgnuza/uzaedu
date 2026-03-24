/** OCR yanıtı */
export interface OcrResponseDto {
  text: string;
  confidence: number;
  needs_rescan?: boolean;
}
