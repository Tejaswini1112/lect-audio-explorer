import { useState } from 'react';
import LectureUploader from '@/components/LectureUploader';
import TranscriptProcessor from '@/components/TranscriptProcessor';
import TopicNavigator from '@/components/TopicNavigator';
import { AudioFile } from '@/types/lecture';
import { FileUploadIcon } from '@/components/icons/FileUploadIcon';

const Index = () => {
  const [currentFile, setCurrentFile] = useState<AudioFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [showTopics, setShowTopics] = useState(false);

  const handleFileSelected = (file: AudioFile) => {
    setCurrentFile(file);
    setIsProcessed(false);
    setShowTopics(false);
  };

  const handleProcessingComplete = () => {
    setIsProcessing(false);
    setIsProcessed(true);
  };

  return (
    <div className="min-h-screen bg-lecture-background flex flex-col">
      {/* Header */}
      <header className="bg-lecture-primary text-white py-6 shadow-md">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">Lecture Topic Navigator</h1>
          <p className="text-lecture-accent mt-2">
            Upload a lecture recording, extract topics, and navigate to specific sections
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {!currentFile && (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)]">
            <FileUploadIcon className="w-24 h-24 text-lecture-primary mb-6" />
            <h2 className="text-2xl font-semibold mb-6 text-center">
              Upload a lecture recording to get started
            </h2>
            <LectureUploader onFileSelected={handleFileSelected} />
          </div>
        )}

        {currentFile && !isProcessed && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="w-full md:w-1/3">
                <h3 className="text-xl font-semibold mb-4">Selected File</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="font-medium">{currentFile.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(currentFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <LectureUploader 
                  onFileSelected={handleFileSelected} 
                  label="Choose different file"
                  buttonVariant="outline" 
                  className="mt-4" 
                />
              </div>
              
              <div className="w-full md:w-2/3 mt-6 md:mt-0">
                <TranscriptProcessor 
                  audioFile={currentFile}
                  onProcessingStart={() => setIsProcessing(true)} 
                  onProcessingComplete={handleProcessingComplete} 
                />
              </div>
            </div>
          </div>
        )}

        {currentFile && isProcessed && !showTopics && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-lg text-gray-700 font-medium">Lecture processed! Ready to explore topics?</p>
            <button
              className="bg-lecture-primary text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-lecture-accent transition"
              onClick={() => setShowTopics(true)}
            >
              Go to Topics
            </button>
          </div>
        )}
        {currentFile && isProcessed && showTopics && (
          <TopicNavigator 
            audioFile={currentFile} 
            onReset={() => {
              setCurrentFile(null);
              setIsProcessed(false);
              setShowTopics(false);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-lecture-primary text-white py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>© 2025 Lecture Topic Navigator</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
