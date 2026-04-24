"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/src/components/ui/Button";
import { Eraser, Search, Loader2 } from "lucide-react";

interface DrawingCanvasProps {
  onRecognize: (imageData: string) => void;
  isRecognizing: boolean;
  recognitionStatus?: string;
}

export function DrawingCanvas({ onRecognize, isRecognizing, recognitionStatus }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setHasContent(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;

    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const handleClear = () => {
    initCanvas();
    setHasContent(false);
  };

  const handleRecognize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL("image/png");
    onRecognize(imageData);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="border-2 border-border rounded-xl cursor-crosshair touch-none bg-white shadow-inner"
          style={{ width: "300px", height: "300px" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {/* grid guide */}
        <div
          className="absolute inset-0 pointer-events-none rounded-xl opacity-10"
          style={{
            backgroundImage: "linear-gradient(#888 1px, transparent 1px), linear-gradient(90deg, #888 1px, transparent 1px)",
            backgroundSize: "75px 75px",
          }}
        />
        {/* center cross */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <div className="w-full h-px bg-gray-500" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <div className="h-full w-px bg-gray-500" />
        </div>
      </div>

      <div className="flex gap-2 w-full max-w-[300px]">
        <Button
          variant="outline"
          onClick={handleClear}
          className="flex-1 gap-2"
          disabled={isRecognizing}
        >
          <Eraser className="h-4 w-4" />
          Xóa
        </Button>
        <Button
          onClick={handleRecognize}
          disabled={isRecognizing || !hasContent}
          className="flex-1 gap-2"
        >
          {isRecognizing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang nhận dạng...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Nhận dạng
            </>
          )}
        </Button>
      </div>

      {recognitionStatus && (
        <p className="text-xs text-muted-foreground text-center">{recognitionStatus}</p>
      )}
    </div>
  );
}
