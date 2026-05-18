import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, User, X } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  onAvatarChange: (url: string | null) => void;
}

export function AvatarUpload({ 
  userId, 
  currentAvatarUrl, 
  firstName, 
  lastName,
  onAvatarChange 
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getInitials = () => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || <User className="h-8 w-8" />;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ongeldig bestandstype",
        description: "Upload een afbeelding (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Bestand te groot",
        description: "Maximum bestandsgrootte is 5MB",
        variant: "destructive",
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      // Delete existing avatar if present
      if (currentAvatarUrl) {
        const existingPath = currentAvatarUrl.split('/').slice(-2).join('/');
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
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      onAvatarChange(publicUrl);
      toast({
        title: "Profielfoto geüpload",
        description: "Je nieuwe profielfoto is opgeslagen.",
      });
    } catch (error) {
      console.error('Upload error:', error);
      setPreviewUrl(null);
      toast({
        title: "Upload mislukt",
        description: "Er is iets misgegaan. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) return;
    
    setUploading(true);
    try {
      const existingPath = currentAvatarUrl.split('/').slice(-2).join('/');
      await supabase.storage.from('user-uploads').remove([existingPath]);

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', userId);

      if (error) throw error;

      onAvatarChange(null);
      setPreviewUrl(null);
      toast({
        title: "Profielfoto verwijderd",
        description: "Je profielfoto is verwijderd.",
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

  const displayUrl = previewUrl || currentAvatarUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
          <AvatarImage src={displayUrl || undefined} alt="Profielfoto" />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        {uploading && (
          <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="h-4 w-4 mr-2" />
          {currentAvatarUrl ? 'Wijzigen' : 'Uploaden'}
        </Button>
        
        {currentAvatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveAvatar}
            disabled={uploading}
            className="text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4 mr-1" />
            Verwijderen
          </Button>
        )}
      </div>
    </div>
  );
}