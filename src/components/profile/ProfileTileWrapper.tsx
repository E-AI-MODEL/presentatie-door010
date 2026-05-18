import { Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import React from "react";

interface ProfileTileWrapperProps {
  id: string;
  children: React.ReactNode;
}

export function ProfileTileWrapper({ id, children }: ProfileTileWrapperProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      as="div"
      className="relative group"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 50 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="absolute top-3 left-3 z-10 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-muted/80 hover:bg-muted text-muted-foreground"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Versleep tegel"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </Reorder.Item>
  );
}
