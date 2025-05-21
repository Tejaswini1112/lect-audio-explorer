import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AudioFile } from '@/types/lecture';
import { useToast } from '@/hooks/use-toast';

interface LectureUploaderProps {
  onFileSelected: (file: AudioFile) => void;
  label?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

const LectureUploader = ({
  onFileSelected,
  label = "Upload Lecture",
  buttonVariant = "default",
  className = ""
}: LectureUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const processFile = async (file: File) => {
    if (!file) return;
    
    // Validate file type
    if (!file.type.includes('audio')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an audio file (.mp3, .wav, etc.)",
        variant: "destructive"
      });
      return;
    }
    
    // Validate file size (limit to 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an audio file less than 100MB",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create object URL for the file
      const url = URL.createObjectURL(file);
      
      const audioFile: AudioFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        file
      };
      
      onFileSelected(audioFile);
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Error Processing File",
        description: "An error occurred while processing your file",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };
  
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className={className}>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? "border-lecture-secondary bg-blue-50" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="audio/*"
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center">
          <p className="mb-4 text-gray-600">
            Drag and drop your lecture audio file here, or
          </p>
          <Button 
            onClick={handleButtonClick}
            disabled={isProcessing}
            variant={buttonVariant}
            className="min-w-32"
          >
            {isProcessing ? "Processing..." : label}
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            Supports audio files up to 100MB (.mp3, .wav)
          </p>
        </div>
      </div>
    </div>
  );
};

export default LectureUploader;
