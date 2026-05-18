import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Loader2, Check, X, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CVUploadProps {
  userId: string;
  currentCVUrl: string | null;
  onCVChange: (url: string | null) => void;
}

export function CVUpload({ userId, currentCVUrl, onCVChange }: CVUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type (PDF only)
    if (file.type !== 'application/pdf') {
      toast({
        title: "Ongeldig bestandstype",
        description: "Upload alleen PDF bestanden",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Bestand te groot",
        description: "Maximum bestandsgrootte is 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const filePath = `${userId}/cv.pdf`;

      // Delete existing CV if present
      if (currentCVUrl) {
        const existingPath = currentCVUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('user-uploads').remove([existingPath]);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cv_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      onCVChange(publicUrl);
      toast({
        title: "CV geüpload",
        description: "Je CV is succesvol opgeslagen.",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload mislukt",
        description: "Er is iets misgegaan. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveCV = async () => {
    if (!currentCVUrl) return;
    
    setUploading(true);
    try {
      const existingPath = currentCVUrl.split('/').slice(-2).join('/');
      await supabase.storage.from('user-uploads').remove([existingPath]);

      const { error } = await supabase
        .from('profiles')
        .update({ cv_url: null })
        .eq('user_id', userId);

      if (error) throw error;

      onCVChange(null);
      toast({
        title: "CV verwijderd",
        description: "Je CV is verwijderd.",
      });
    } catch (error) {
      console.error('Remove error:', error);
      toast({
        title: "Verwijderen mislukt",
        description: "Er is iets misgegaan. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card 
      className={`transition-all ${dragActive ? 'border-primary bg-primary/5' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-medium">Curriculum Vitae</span>
            {currentCVUrl ? (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Check className="h-3 w-3 mr-1" />
                Geüpload
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Ontbreekt
              </Badge>
            )}
          </div>

          {currentCVUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Je CV is succesvol geüpload en zichtbaar voor adviseurs.
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(currentCVUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Bekijken
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Vervangen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCV}
                  disabled={uploading}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Verwijderen
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className="border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploaden...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Sleep je CV hierheen of <span className="text-primary">klik om te uploaden</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Alleen PDF, max. 10MB
                  </p>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
}