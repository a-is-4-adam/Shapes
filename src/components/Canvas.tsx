import React, { useRef, useEffect, useState } from 'react';
import { Hand, Pencil, MousePointer } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Polygon {
  points: Point[];
  color: string;
}

type Tool = 'hand' | 'pencil' | 'select';
type DragMode = 'move' | 'resize';

const HANDLE_SIZE = 8;
const EDGE_DETECTION_THRESHOLD = 10;

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [dragMode, setDragMode] = useState<DragMode>('move');
  const [selectedHandle, setSelectedHandle] = useState<number | null>(null);

  const colors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', 
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all polygons
    polygons.forEach((polygon, index) => {
      drawPolygon(ctx, polygon.points, polygon.color, index === selectedPolygon);
    });

    // Draw current drawing points
    if (currentPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      currentPoints.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = '#666';
      ctx.stroke();

      currentPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#666';
        ctx.fill();
      });
    }

    // Draw resize handles for selected polygon
    if (selectedPolygon !== null && activeTool === 'select') {
      const polygon = polygons[selectedPolygon];
      polygon.points.forEach((point, index) => {
        drawHandle(ctx, point, index === selectedHandle);
      });
    }
  }, [currentPoints, polygons, selectedPolygon, selectedHandle, activeTool]);

  const drawPolygon = (
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    isSelected: boolean
  ) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((point) => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = color + '80';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#000' : color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
  };

  const drawHandle = (
    ctx: CanvasRenderingContext2D,
    point: Point,
    isSelected: boolean
  ) => {
    ctx.beginPath();
    ctx.rect(
      point.x - HANDLE_SIZE / 2,
      point.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    );
    ctx.fillStyle = isSelected ? '#2563eb' : '#fff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  };

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const findClosestEdgePoint = (point: Point, polygonPoints: Point[]): { point: Point; index: number } | null => {
    let closestPoint: Point | null = null;
    let closestDistance = Infinity;
    let insertIndex = -1;

    for (let i = 0; i < polygonPoints.length; i++) {
      const start = polygonPoints[i];
      const end = polygonPoints[(i + 1) % polygonPoints.length];

      const projection = projectPointOnLine(point, start, end);
      if (!projection) continue;

      const distance = Math.sqrt(
        Math.pow(point.x - projection.x, 2) + Math.pow(point.y - projection.y, 2)
      );

      if (distance < EDGE_DETECTION_THRESHOLD && distance < closestDistance) {
        closestDistance = distance;
        closestPoint = projection;
        insertIndex = i + 1;
      }
    }

    return closestPoint ? { point: closestPoint, index: insertIndex } : null;
  };

  const projectPointOnLine = (point: Point, start: Point, end: Point): Point | null => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return null;

    const t = (
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      (length * length)
    );

    if (t < 0 || t > 1) return null;

    return {
      x: start.x + t * dx,
      y: start.y + t * dy
    };
  };

  const handlePencilInteraction = (point: Point) => {
    if (currentPoints.length > 2) {
      const startPoint = currentPoints[0];
      const distance = Math.sqrt(
        Math.pow(startPoint.x - point.x, 2) + Math.pow(startPoint.y - point.y, 2)
      );

      if (distance < 20) {
        setPolygons([
          ...polygons,
          {
            points: [...currentPoints],
            color: colors[polygons.length % colors.length],
          },
        ]);
        setCurrentPoints([]);
        return;
      }
    }

    // Check for edge splitting when no polygon is being drawn
    if (currentPoints.length === 0) {
      for (let i = polygons.length - 1; i >= 0; i--) {
        const edgePoint = findClosestEdgePoint(point, polygons[i].points);
        if (edgePoint) {
          const updatedPolygons = [...polygons];
          const updatedPoints = [...updatedPolygons[i].points];
          updatedPoints.splice(edgePoint.index, 0, edgePoint.point);
          updatedPolygons[i] = {
            ...updatedPolygons[i],
            points: updatedPoints
          };
          setPolygons(updatedPolygons);
          setSelectedPolygon(i);
          setSelectedHandle(edgePoint.index);
          return;
        }
      }
    }

    setCurrentPoints([...currentPoints, point]);
  };

  const isPointNearHandle = (point: Point, handlePoint: Point): boolean => {
    const distance = Math.sqrt(
      Math.pow(handlePoint.x - point.x, 2) + Math.pow(handlePoint.y - point.y, 2)
    );
    return distance < HANDLE_SIZE;
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (activeTool === 'pencil') return;

    const point = getCanvasPoint(e);
    
    if (activeTool === 'select' && selectedPolygon !== null) {
      const polygon = polygons[selectedPolygon];
      for (let i = 0; i < polygon.points.length; i++) {
        if (isPointNearHandle(point, polygon.points[i])) {
          setDragMode('resize');
          setSelectedHandle(i);
          setIsDragging(true);
          setDragStart(point);
          return;
        }
      }
    }

    let found = false;
    for (let i = polygons.length - 1; i >= 0; i--) {
      if (isPointInPolygon(point, polygons[i].points)) {
        setSelectedPolygon(i);
        setIsDragging(true);
        setDragStart(point);
        setDragMode('move');
        found = true;
        break;
      }
    }

    if (!found) {
      setSelectedPolygon(null);
      setSelectedHandle(null);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDragging || selectedPolygon === null || !dragStart) return;

    const point = getCanvasPoint(e);
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;

    const updatedPolygons = [...polygons];
    
    if (dragMode === 'resize' && selectedHandle !== null) {
      const updatedPoints = [...updatedPolygons[selectedPolygon].points];
      updatedPoints[selectedHandle] = {
        x: updatedPoints[selectedHandle].x + dx,
        y: updatedPoints[selectedHandle].y + dy
      };
      updatedPolygons[selectedPolygon] = {
        ...updatedPolygons[selectedPolygon],
        points: updatedPoints
      };
    } else if (dragMode === 'move') {
      const updatedPoints = updatedPolygons[selectedPolygon].points.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      updatedPolygons[selectedPolygon] = {
        ...updatedPolygons[selectedPolygon],
        points: updatedPoints,
      };
    }

    setPolygons(updatedPolygons);
    setDragStart(point);
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDragStart(null);
    setDragMode('move');
    if (!isDragging) {
      setSelectedHandle(null);
    }
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isDragging) return;

    const point = getCanvasPoint(e);

    if (activeTool === 'pencil') {
      handlePencilInteraction(point);
    }
  };

  const isPointInPolygon = (point: Point, polygonPoints: Point[]) => {
    let inside = false;
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
      const xi = polygonPoints[i].x;
      const yi = polygonPoints[i].y;
      const xj = polygonPoints[j].x;
      const yj = polygonPoints[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);
    if (tool === 'pencil') {
      setSelectedPolygon(null);
      setSelectedHandle(null);
    }
    setIsDragging(false);
    setDragStart(null);
    if (tool === 'hand' || tool === 'select') {
      setCurrentPoints([]);
    }
  };

  const getToolMessage = () => {
    switch (activeTool) {
      case 'pencil':
        return 'Click to draw points, click near start to close shape. Click on edges to add handles';
      case 'hand':
        return 'Click and drag to move shapes';
      case 'select':
        return 'Click a shape to select it, then drag corners to resize';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="flex items-center gap-2 text-gray-700">
        <span className="text-sm">{getToolMessage()}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className={`border border-gray-200 rounded-lg shadow-md bg-white touch-none ${
          activeTool === 'pencil' ? 'cursor-crosshair' : 
          activeTool === 'hand' ? 'cursor-move' : 'cursor-pointer'
        }`}
        onClick={handleInteraction}
        onTouchStart={(e) => {
          if (activeTool === 'pencil') {
            handleInteraction(e);
          } else {
            handleStart(e);
          }
        }}
        onMouseDown={handleStart}
        onTouchMove={handleMove}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onTouchEnd={handleEnd}
        onMouseLeave={handleEnd}
        onTouchCancel={handleEnd}
      />
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleToolChange('hand')}
              className={`p-2 rounded-lg transition-colors ${
                activeTool === 'hand'
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Move Tool"
            >
              <Hand className="w-6 h-6" />
            </button>
            <button
              onClick={() => handleToolChange('select')}
              className={`p-2 rounded-lg transition-colors ${
                activeTool === 'select'
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Select Tool"
            >
              <MousePointer className="w-6 h-6" />
            </button>
            <button
              onClick={() => handleToolChange('pencil')}
              className={`p-2 rounded-lg transition-colors ${
                activeTool === 'pencil'
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Draw Tool"
            >
              <Pencil className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}