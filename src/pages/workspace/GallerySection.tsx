import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, Images, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSignedUrls } from "@/hooks/useSignedUrls";
import { SectionHint } from "@/components/ui/section-hint";

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
  disabled: boolean;
}

const SortableImage: React.FC<SortableImageProps> = ({ id, url, index, onRemove, disabled }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
      <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      {!disabled && (
        <>
          <button
            {...attributes}
            {...listeners}
            className="absolute top-1 left-1 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onRemove(index)}
            className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
};

const GallerySection = React.forwardRef<HTMLDivElement>((_, ref) => {
  const { event, autosave, isArchived } = useEventWorkspace();
  const [uploading, setUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const galleryImages: string[] = event && Array.isArray((event as any).gallery_images) ? (event as any).gallery_images : [];
  const imageIds = galleryImages.map((url, i) => `${i}::${url}`);

  const removeImage = useCallback((idx: number) => {
    const updated = galleryImages.filter((_, i) => i !== idx);
    autosave({ gallery_images: updated } as any);
  }, [galleryImages, autosave]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = imageIds.indexOf(active.id as string);
    const newIndex = imageIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(galleryImages, oldIndex, newIndex);
    autosave({ gallery_images: reordered } as any);
  }, [galleryImages, imageIds, autosave]);

  if (!event) return null;

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const newPaths = [...galleryImages];
    for (const file of Array.from(files)) {
      const path = `events/${event.id}/gallery/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("event-assets").upload(path, file);
      if (error) { toast.error("Upload failed"); continue; }
      newPaths.push(path);
    }
    autosave({ gallery_images: newPaths } as any);
    setUploading(false);
  };

  const galleryUrls = useSignedUrls("event-assets", galleryImages);

  return (
    <Card ref={ref}>
      {galleryImages.length === 0 && (
        <div className="px-6 pt-6">
          <SectionHint
            sectionKey="gallery"
            title="Gallery"
            description="Upload event photos. The gallery appears as a full image grid section on the public page. Best used after the event."
          />
        </div>
      )}
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Images className="h-5 w-5" /> Photo Gallery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Upload images to showcase in the public event website gallery section. Drag to reorder.
        </p>

        {galleryImages.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={imageIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {galleryImages.map((_, i) => (
                  <SortableImage
                    key={imageIds[i]}
                    id={imageIds[i]}
                    url={galleryUrls[i] || ""}
                    index={i}
                    onRemove={removeImage}
                    disabled={!!isArchived}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {galleryImages.length === 0 && (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
            <Images className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No gallery images yet. Upload some to get started.</p>
          </div>
        )}

        {!isArchived && (
          <Button variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => document.getElementById("gallery-upload")?.click()}>
            <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Images"}
          </Button>
        )}
        <input id="gallery-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
      </CardContent>
    </Card>
  );
});

GallerySection.displayName = "GallerySection";

export default GallerySection;
