import * as ort from 'onnxruntime-web';
import type { BoundingBox } from '../types';

export class PotholeDetector {
    private session: ort.InferenceSession | null = null;
    private readonly modelWidth = 640;
    private readonly modelHeight = 640;
    private readonly confidenceThreshold = 0.5;
    private readonly iouThreshold = 0.45;
    private readonly modelUrl = 'https://huggingface.co/LordPatil/potehole-detection-yolo11n/resolve/main/best.onnx';

    // FIX: The constructor now accepts the wasm path to satisfy the error "Expected 1 arguments, but got 0" and improve configurability.
    constructor(wasmPaths: string) {
        ort.env.wasm.wasmPaths = wasmPaths;
    }

    async initialize(): Promise<void> {
        this.session = await ort.InferenceSession.create(this.modelUrl, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
        });
    }

    async detect(image: HTMLImageElement | HTMLVideoElement): Promise<BoundingBox[]> {
        if (!this.session) {
            throw new Error("Session not initialized. Call initialize() first.");
        }

        const [inputTensor, scaleX, scaleY] = this.preprocess(image);

        const feeds: Record<string, ort.Tensor> = {};
        feeds[this.session.inputNames[0]] = inputTensor;

        const results = await this.session.run(feeds);
        const outputData = results[this.session.outputNames[0]].data as Float32Array;
        
        return this.postprocess(outputData, scaleX, scaleY);
    }
    
    private preprocess(image: HTMLImageElement | HTMLVideoElement): [ort.Tensor, number, number] {
        const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.videoWidth;
        const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.videoHeight;
        
        const canvas = document.createElement('canvas');
        canvas.width = this.modelWidth;
        canvas.height = this.modelHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");
        
        // Scale image to fit model input size, preserving aspect ratio and padding
        const scale = Math.min(this.modelWidth / sourceWidth, this.modelHeight / sourceHeight);
        const scaledWidth = sourceWidth * scale;
        const scaledHeight = sourceHeight * scale;
        const dx = (this.modelWidth - scaledWidth) / 2;
        const dy = (this.modelHeight - scaledHeight) / 2;

        ctx.fillStyle = 'rgb(114, 114, 114)'; // YOLOv8 recommended padding color
        ctx.fillRect(0, 0, this.modelWidth, this.modelHeight);
        ctx.drawImage(image, dx, dy, scaledWidth, scaledHeight);
        
        const imageData = ctx.getImageData(0, 0, this.modelWidth, this.modelHeight);
        const { data } = imageData;
        
        const red: number[] = [], green: number[] = [], blue: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
            red.push(data[i] / 255);
            green.push(data[i + 1] / 255);
            blue.push(data[i + 2] / 255);
        }
        
        const transposedData = red.concat(green, blue);
        const float32Data = new Float32Array(transposedData);
        
        const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, this.modelHeight, this.modelWidth]);
        
        const scaleX = sourceWidth / scaledWidth;
        const scaleY = sourceHeight / scaledHeight;

        return [inputTensor, scaleX, scaleY];
    }
    
    private postprocess(outputData: Float32Array, scaleX: number, scaleY: number): BoundingBox[] {
        // The model output shape is [1, 5, 8400] which is [batch, (cx,cy,w,h,conf), boxes]
        // We need to transpose it to [1, 8400, 5] for easier processing
        const numBoxes = 8400;
        const boxDataSize = 5;
        const boxes: BoundingBox[] = [];

        for (let i = 0; i < numBoxes; i++) {
            const confidence = outputData[4 * numBoxes + i];
            if (confidence < this.confidenceThreshold) {
                continue;
            }

            const cx = outputData[i];
            const cy = outputData[numBoxes + i];
            const w = outputData[2 * numBoxes + i];
            const h = outputData[3 * numBoxes + i];

            const x1 = (cx - w / 2);
            const y1 = (cy - h / 2);
            const x2 = (cx + w / 2);
            const y2 = (cy + h / 2);
            
            boxes.push({ x1, y1, x2, y2, confidence, label: 'pothole' });
        }
        
        const nmsBoxes = this.nonMaxSuppression(boxes);
        
        // Rescale boxes to original image dimensions
        const scaledModelWidth = this.modelWidth / scaleX;
        const scaledModelHeight = this.modelHeight / scaleY;

        const dx = (this.modelWidth - scaledModelWidth) / 2;
        const dy = (this.modelHeight - scaledModelHeight) / 2;


        return nmsBoxes.map(box => ({
            ...box,
            x1: (box.x1 - dx) * scaleX,
            y1: (box.y1 - dy) * scaleY,
            x2: (box.x2 - dx) * scaleX,
            y2: (box.y2 - dy) * scaleY,
        }));
    }

    private nonMaxSuppression(boxes: BoundingBox[]): BoundingBox[] {
        const sortedBoxes = boxes.sort((a, b) => b.confidence - a.confidence);
        const result: BoundingBox[] = [];

        while (sortedBoxes.length > 0) {
            result.push(sortedBoxes[0]);
            const remainingBoxes = [];
            for (let i = 1; i < sortedBoxes.length; i++) {
                const iou = this.calculateIoU(sortedBoxes[0], sortedBoxes[i]);
                if (iou < this.iouThreshold) {
                    remainingBoxes.push(sortedBoxes[i]);
                }
            }
            sortedBoxes.splice(0, sortedBoxes.length, ...remainingBoxes);
        }
        return result;
    }

    private calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
        const x1 = Math.max(box1.x1, box2.x1);
        const y1 = Math.max(box1.y1, box2.y1);
        const x2 = Math.min(box1.x2, box2.x2);
        const y2 = Math.min(box1.y2, box2.y2);

        const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        
        const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
        const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);

        const unionArea = box1Area + box2Area - intersectionArea;

        return intersectionArea / unionArea;
    }
}
