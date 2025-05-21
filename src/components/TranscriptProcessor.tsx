import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import TopicNavigator from "./TopicNavigator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AudioFile, Transcript, Topic, TranscriptionResponse, TranscriptionSegment } from "@/types/lecture";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { transcribeAudio, detectTopics } from "@/lib/openai";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AudioProcessor } from "@/lib/audio";
import SegmentedTranscript from "./SegmentedTranscript";
import { formatTime } from "@/utils/format";

interface TranscriptProcessorProps {
  audioFile: AudioFile;
  onProcessingStart: () => void;
  onProcessingComplete: () => void;
}

// Set your deployed backend URL here
const API_BASE = "https://lectopia-audio-explorer.onrender.com";

async function uploadAndTranscribe(file: File) {
  // Show console message for debugging
  console.log('Uploading and transcribing file:', file.name);
  
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/transcribe/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('Transcription API error:', response.status, response.statusText);
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.text || '',
      segments: data.segments || [],
      quota_exceeded: data.quota_exceeded || false
    };
  } catch (error) {
    console.error('Error in uploadAndTranscribe:', error);
    throw error;
  }
}

async function extractTopics(transcript: string) {
  // Mock topics for now
  if (!transcript) {
    return [];
  }
  
  console.log('Extracting topics from transcript of length:', transcript.length);
  
  try {
    const response = await fetch(`${API_BASE}/extract-topics/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: transcript }),
    }).then(res => res.json()).then(data => data.topics);
    
    if (!response) {
      throw new Error(`Topic extraction failed: ${response}`);
    }
    
    return response;
  } catch (error) {
    console.error('Error extracting topics:', error);
    // Return mock topics as fallback
    return [
      { 
        topic: "Introduction",
        description: "Overview of the lecture content",
        start: 0,
        end: 60
      },
      {
        topic: "Main Concepts",
        description: "Discussion of key theoretical concepts",
        start: 61,
        end: 180
      },
      {
        topic: "Practical Applications",
        description: "Real-world applications of the material",
        start: 181,
        end: 300
      }
    ];
  }
}

const TranscriptProcessor: React.FC<TranscriptProcessorProps> = ({ 
  audioFile, 
  onProcessingStart, 
  onProcessingComplete 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const { toast } = useToast();
  const [, setTranscriptData] = useLocalStorage<TranscriptionResponse | null>("lectureTranscript", null);
  const [transcript, setTranscript] = useState<string>("");
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isExtractingTopics, setIsExtractingTopics] = useState(false);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  
  // Initialize the audio processor
  useEffect(() => {
    audioProcessorRef.current = new AudioProcessor();
    
    return () => {
      // Clean up the audio processor when component unmounts
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
      }
    };
  }, []);
  
  useEffect(() => {
    // Load transcript from local storage if needed
  }, []);
  
  // Calculate time elapsed
  const [timeElapsed, setTimeElapsed] = useState(0);
  useEffect(() => {
    if (isProcessing && startTime) {
      const timer = setInterval(() => {
        setTimeElapsed(Math.round((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isProcessing, startTime]);
  
  // Process audio when the file changes
  useEffect(() => {
    // Reset state when a new file is loaded
    if (audioFile && audioFile.file) {
      console.log("New audio file loaded:", audioFile.name);
      setTranscript("");
      setSegments([]);
      setTopics([]);
      
      // Load the audio file into the audio processor
      if (audioProcessorRef.current) {
        audioProcessorRef.current.loadAudio(audioFile.file)
          .catch(error => {
            console.error("Error loading audio file:", error);
            toast({
              title: "Audio Load Error",
              description: "Failed to load audio file. Please try a different file.",
              variant: "destructive"
            });
          });
      }
    }
  }, [audioFile, toast]);
  
  const processAudio = async () => {
    if (!audioFile || !audioFile.file) {
      toast({
        title: "No File Selected",
        description: "Please select an audio file to process",
        variant: "destructive"
      });
      return;
    }

    // Validate file before processing
    if (!audioFile.file.type.startsWith('audio/')) {
      toast({
        title: "Invalid File",
        description: "Please upload a valid audio file",
        variant: "destructive"
      });
      setStatusMessage("Invalid file type.");
      return;
    }
    
    try {
      setIsProcessing(true);
      setProgress(0);
      setStartTime(Date.now());
      setStatusMessage("Starting transcription (this may take a few moments)...");
      onProcessingStart();
      
      // Process audio file without timeout - prioritize real transcription
      // We'll let the transcription take as long as needed for real data
      let transcriptResult;
      try {
        // No timeout, just wait for the real transcription to complete
        setStatusMessage("Transcribing audio file - this may take several minutes for longer files...");
        transcriptResult = await uploadAndTranscribe(audioFile.file);
        setProgress(40); // Update progress after transcription
      } catch (timeoutError: any) {
        console.warn('Transcription failed:', timeoutError.message);
        setStatusMessage("Transcription failed. Please try again with a different file or check your API key.");
        toast({
          title: "Processing Failed",
          description: timeoutError.message || 'Unknown error occurred during transcription',
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      setProgress(50);
      
      // Explicitly log to verify transcript text
      console.log('Transcript text received:', transcriptResult.text);
      
      // Check if we got a valid response but with mock data
      const isMockData = transcriptResult.text?.includes('mock transcript') || false;
      if (isMockData || transcriptResult.quota_exceeded) {
        console.log('Detected mock data in transcript response');
        toast({
          title: "API Key Issue",
          description: "The OpenAI API key may have insufficient quota. If you need real transcription, please update your API key.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Using Real Transcription",
          description: "Successfully transcribed audio using real OpenAI transcription.",
          variant: "default"
        });
      }
      
      // Get segments from the response if available
      const transcriptSegments = transcriptResult.segments || [];
      console.log('Received transcript segments:', transcriptSegments.length);
      
      // Update the transcript and segments state
      setTranscript(transcriptResult.text || '');
      setSegments(transcriptSegments);
      console.log('Set transcript state:', transcriptResult.text?.substring(0, 100) + '...');
      
      setProgress(70);
      setStatusMessage("Transcription complete. Extracting topics...");
      
      // Extract topics
      setIsExtractingTopics(true);
      try {
        // For topic extraction, add more error handling
        if (!transcriptResult.text || transcriptResult.text.trim().length === 0) {
          throw new Error('No transcript text available for topic extraction');
        }
        
        const extractedTopics = await extractTopics(transcriptResult.text);
        console.log('Topics extracted successfully:', extractedTopics);
        
        // Format topics for UI and storage
        const formattedTopics = extractedTopics.map((topic: any, index: number) => {
          // Make sure we have the required fields
          const topicStart = typeof topic.start === 'number' ? topic.start : 0;
          const topicEnd = typeof topic.end === 'number' ? topic.end : 0;
          
          // Find segments that belong to this topic based on time range
          const topicSegments = transcriptSegments
            .map((segment, segmentIndex) => {
              // Check if segment overlaps with the topic's time range
              if (segment.end >= topicStart && segment.start <= topicEnd) {
                return segmentIndex; // Return the index of the segment
              }
              return null;
            })
            .filter((segmentIndex): segmentIndex is number => segmentIndex !== null);
          
          return {
            id: index.toString(),
            title: topic.topic || topic.title || `Topic ${index + 1}`,
            description: topic.description || "No description available",
            start: topicStart,
            end: topicEnd,
            segments: topicSegments // Populated with segment indices
          };
        });

        console.log('Formatted topics for storage:', formattedTopics);
        setTopics(formattedTopics);
        
        // Prepare transcript data for saving
        const transcriptData = {
          transcript: {
            text: transcriptResult.text || '',
            segments: transcriptSegments
          },
          topics: formattedTopics
        };
        
        // Save to local storage
        setTranscriptData(transcriptData);
        console.log('Saved transcript data to local storage:', transcriptData);
      } catch (topicError: any) {
        console.error("Error extracting topics:", topicError);
        toast({
          title: "Topic Extraction Issue",
          description: "Could not extract topics from transcript. Using mock topics instead.",
          variant: "default"
        });
        
        // Use mock topics as fallback
        const mockTopics = [
          {
            id: "1",
            title: "Introduction to the Subject",
            description: "Overview of the course content and learning objectives.",
            start: 0,
            end: 180,
            segments: []
          },
          {
            id: "2",
            title: "Key Concepts",
            description: "Explanation of fundamental theories and principles.",
            start: 210,
            end: 450,
            segments: []
          },
          {
            id: "3",
            title: "Practical Applications",
            description: "Real-world examples and case studies of the concepts in action.",
            start: 480,
            end: 720,
            segments: []
          }
        ];
        
        setTopics(mockTopics);
        
        // Save mock data to local storage
        const mockTranscriptData = {
          transcript: {
            text: transcriptResult.text || '',
            segments: transcriptSegments
          },
          topics: mockTopics
        };
        
        setTranscriptData(mockTranscriptData);
      } finally {
        setIsExtractingTopics(false);
      }
      
      // Double check that transcript is saved to local storage
      const savedData = localStorage.getItem("lectureTranscript");
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        console.log('Verified saved transcript text length:', parsedData.transcript?.text?.length || 0);
        console.log('Verified saved topics count:', parsedData.topics?.length || 0);
      }
      
      setProgress(100);
      setStatusMessage("Processing complete!");
      
      // Processing complete
      setIsProcessing(false);
      onProcessingComplete();
    } catch (error: any) {
      console.error("Error processing audio:", error);
      setStatusMessage(`Error: ${error.message || 'Unknown error'}`);
      setIsProcessing(false);
      toast({
        title: "Processing Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive"
      });
    }
  };

  // If we have a processed audio file, show the topic navigator
  if (transcript && !isProcessing) {
    return (
      <TopicNavigator
        audioFile={audioFile}
        onReset={() => {
          setTranscript("");
          setSegments([]);
          setTopics([]);
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Process Lecture</h2>
        <p className="text-gray-600">
          Click the button below to transcribe your audio file, extract topics, and create a
          navigable index.
        </p>
      </div>
      
      <div className="flex justify-center py-8">
        <div className="space-y-4 max-w-2xl w-full">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium">Selected File:</h3>
            <Badge variant="secondary">
              {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">
            This process may take several minutes depending on the length of your recording. For a 30-minute lecture, expect 5-10 minutes of processing time.
          </p>
        </div>
      </div>
      
      <div className="flex justify-center">
        {isProcessing ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="relative mb-2">
                <Progress value={progress} className="h-2" />
              </div>
              <div className="text-sm text-muted-foreground">
                {statusMessage}
                {timeElapsed > 0 && ` (${timeElapsed}s)`}
              </div>
            </div>
          </div>
        ) : transcript ? (
          <Tabs defaultValue="segmented" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="segmented">Segmented View</TabsTrigger>
              <TabsTrigger value="full">Full Transcript</TabsTrigger>
            </TabsList>
            
            <TabsContent value="segmented">
              <SegmentedTranscript 
                segments={segments}
                audioProcessor={audioProcessorRef.current}
              />
            </TabsContent>
            
            <TabsContent value="full">
              <Card>
                <CardContent className="p-6">
                  <pre className="whitespace-pre-wrap">{transcript}</pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground">
            <p>Upload an audio file to generate a transcript</p>
          </div>
        )}
      </div>
      
      <div className="flex justify-center">
        <Button
          onClick={processAudio}
          disabled={isProcessing || !audioFile}
          className="w-full max-w-md"
        >
          {isProcessing ? "Processing..." : "Process Audio"}
        </Button>
      </div>
    </div>
  );
};

export default TranscriptProcessor;
