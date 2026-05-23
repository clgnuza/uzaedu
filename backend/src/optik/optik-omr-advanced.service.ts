import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';
import type { OmrScanLayout } from './optik-omr-layout';

export interface OmrAdvancedResult {
  answers: Record<number, string>;
  confidence: number;
  needs_rescan: boolean;
  anchor_score: number;
  per_question: Array<{
    question: number;
    label: string;
    fill: number;
    ambiguous: boolean;
  }>;
  warp_engine: string;
  processing_time_ms: number;
}

@Injectable()
export class OptikOmrAdvancedService {
  private readonly logger = new Logger(OptikOmrAdvancedService.name);
  private pythonPath = 'python3';

  constructor() {
    // Windows için python kontrolü
    if (process.platform === 'win32') {
      this.pythonPath = 'python';
    }
  }

  /**
   * Native OpenCV ile server-side OMR decode
   * @param imageBase64 - Base64 JPEG görüntü (data:image/jpeg;base64,... veya raw)
   * @param layout - OMR layout (bubbles, anchors)
   * @param maxQuestion - Maksimum soru sayısı (opsiyonel)
   */
  async decodeOmrAdvanced(
    imageBase64: string,
    layout: OmrScanLayout,
    maxQuestion?: number,
  ): Promise<OmrAdvancedResult> {
    const scriptPath = join(process.cwd(), 'tools', 'optik-omr-advanced.py');

    const input = {
      image: imageBase64,
      layout: {
        bubbles: layout.bubbles.map((b) => ({
          question: b.question,
          label: b.label,
          x: b.x,
          y: b.y,
          r: b.r,
        })),
        anchors: layout.anchors.map((a) => ({
          x: a.x,
          y: a.y,
          size: a.size,
        })),
        question_count: layout.question_count,
        width: layout.page_width,
        height: layout.page_height,
      },
      maxQuestion,
    };

    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [scriptPath]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`Python script failed: ${stderr}`);
          reject(new Error(`Python OMR processing failed: ${stderr}`));
          return;
        }

        try {
          const output = JSON.parse(stdout);

          if (!output.success) {
            this.logger.error(`OMR decode error: ${output.error}`);
            reject(new Error(`OMR decode error: ${output.error}`));
            return;
          }

          resolve(output.result);
        } catch (err) {
          this.logger.error(`Failed to parse Python output: ${err}`);
          reject(new Error(`Failed to parse Python output: ${err}`));
        }
      });

      python.stdin.write(JSON.stringify(input));
      python.stdin.end();
    });
  }

  /**
   * Python + OpenCV kurulu mu kontrol et
   */
  async checkPythonAvailability(): Promise<{ available: boolean; error?: string }> {
    return new Promise((resolve) => {
      const python = spawn(this.pythonPath, ['-c', 'import cv2, numpy; print("OK")']);

      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0 || !output.includes('OK')) {
          resolve({
            available: false,
            error: error || 'Python veya OpenCV bulunamadı',
          });
        } else {
          resolve({ available: true });
        }
      });
    });
  }
}
