import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AudioFile, Topic, TranscriptionResponse } from '@/types/lecture';
import { formatTime } from '@/utils/format';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AudioProcessor } from '@/lib/audio';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopicNavigatorProps {
  audioFile: AudioFile;
  onReset: () => void;
}

const TopicNavigator = ({ audioFile, onReset }: TopicNavigatorProps) => {
  const [transcriptData] = useLocalStorage<TranscriptionResponse | null>("lectureTranscript", null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const { toast } = useToast();
  
  // Audio loading states
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null);

  // Memoized filtered topics
  const filteredTopics = useMemo(() => {
    if (!searchQuery) return transcriptData?.topics || [];
    
    const query = searchQuery.toLowerCase();
    return transcriptData?.topics?.filter(topic => 
      topic.title.toLowerCase().includes(query) ||
      topic.description.toLowerCase().includes(query)
    ) || [];
  }, [searchQuery, transcriptData?.topics]);

  // Helper function to categorize topics
  const categorizeTopics = (topics: Topic[]) => {
    const categories = new Map<string, Topic[]>();
    
    topics.forEach(topic => {
      // Default to 'general' if title is missing
      const title = topic.title || '';
      const category = title.split(' ')[0].toLowerCase() || 'general';
      
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)?.push(topic);
    });
    
    return Array.from(categories.entries());
  };

  // Memoized categorized topics
  const categorizedTopics = useMemo(() => {
    if (!transcriptData?.topics) return [];
    return categorizeTopics(transcriptData.topics);
  }, [transcriptData?.topics]);

  useEffect(() => {
    // Initialize audio processor
    audioProcessorRef.current = new AudioProcessor();
    setAudioLoaded(false);
    setAudioLoadError(null);
    
    // Load audio file with proper error handling
    if (audioFile.file) {
      console.log('Loading audio file:', audioFile.file.name, 'Size:', audioFile.file.size);
      
      const loadAudio = async () => {
        try {
          if (audioProcessorRef.current) {
            await audioProcessorRef.current.loadAudio(audioFile.file);
            console.log('Audio file loaded successfully');
            setAudioLoaded(true);
          } else {
            setAudioLoadError('Audio processor not initialized');
            console.error('Audio processor not initialized');
          }
        } catch (error: any) {
          console.error('Error loading audio file:', error);
          setAudioLoadError(`Failed to load audio: ${error?.message || 'Unknown error'}`);
        }
      };
      
      loadAudio();
    } else {
      console.warn('No audio file available to load');
      setAudioLoadError('No audio file available');
    }

    return () => {
      console.log('Cleaning up audio processor');
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
      }
    };
  }, [audioFile]);

  useEffect(() => {
    if (transcriptData?.topics && transcriptData.topics.length > 0 && !selectedTopic) {
      setSelectedTopic(transcriptData.topics[0]);
    }
  }, [transcriptData, selectedTopic]);

  const handleTopicSelect = async (topic: Topic) => {
    setSelectedTopic(topic);
    
    if (!audioLoaded) {
      console.warn('Cannot play topic - audio not loaded yet');
      toast({
        title: "Audio Not Ready",
        description: audioLoadError || "Audio is still loading. Please wait a moment and try again.",
        variant: "default"
      });
      return;
    }
    
    if (audioProcessorRef.current) {
      try {
        console.log(`Playing topic from time ${topic.start}s`);
        if (typeof topic.start !== 'number') {
          console.warn('Invalid start time for topic:', topic);
          return;
        }
        
        await audioProcessorRef.current.playSegment(topic.start);
        setIsPlaying(true);
      } catch (error) {
        console.error("Error playing topic:", error);
        // Show user-friendly error message
        toast({
          title: "Playback Error",
          description: "Could not play the selected topic. Please try again or reload the page.",
          variant: "destructive"
        });
      }
    } else {
      console.error("Audio processor not initialized");
      toast({
        title: "Playback Error",
        description: "Audio player not initialized. Please reload the page and try again.",
        variant: "destructive"
      });
    }
  };

  const playPauseTopic = async () => {
    if (!audioProcessorRef.current) {
      console.error("Audio processor not initialized");
      toast({
        title: "Playback Error",
        description: "Audio player not initialized. Please reload the page and try again.",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedTopic) {
      console.warn("No topic selected for playback");
      toast({
        title: "No Topic Selected",
        description: "Please select a topic to play.",
        variant: "default"
      });
      return;
    }

    if (isPlaying) {
      console.log("Stopping playback");
      audioProcessorRef.current.stop();
      setIsPlaying(false);
    } else {
      if (!audioLoaded) {
        console.warn('Cannot play topic - audio not loaded yet');
        toast({
          title: "Audio Not Ready",
          description: audioLoadError || "Audio is still loading. Please wait a moment and try again.",
          variant: "default"
        });
        return;
      }
      
      try {
        console.log(`Playing topic from time ${selectedTopic.start}s`);
        if (typeof selectedTopic.start !== 'number') {
          console.warn('Invalid start time for topic:', selectedTopic);
          return;
        }
        
        await audioProcessorRef.current.playSegment(selectedTopic.start);
        setIsPlaying(true);
      } catch (error) {
        console.error("Error playing topic:", error);
        // Show user-friendly error message
        toast({
          title: "Playback Error",
          description: "Could not play the selected topic. Please try again or reload the page.",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left panel - Topic list */}
        <div className="w-full md:w-1/3 pr-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Topics</h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search topics..."
                className="pl-8 h-8 w-full md:w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Debug information */}
          <div className="mb-4 p-2 border border-blue-200 bg-blue-50 rounded text-xs">
            <p><strong>Topics found:</strong> {transcriptData?.topics?.length || 0}</p>
            <p><strong>Filtered topics:</strong> {filteredTopics.length}</p>
            <p><strong>Categorized topics:</strong> {categorizedTopics.length}</p>
            <p><strong>Audio loaded:</strong> {audioLoaded ? 'Yes' : 'No'}</p>
            {audioLoadError && <p><strong>Audio error:</strong> {audioLoadError}</p>}
          </div>
          
          <ScrollArea className="h-[500px] pr-4">
            {/* Check if we have any topics */}
            {filteredTopics.length > 0 ? (
              <div className="space-y-4">
                {categorizedTopics.length > 0 ? (
                  // Display categorized topics
                  categorizedTopics.map(([category, topics]) => (
                    <div key={category} className="mb-6">
                      <h4 className="text-sm font-bold mb-2 text-gray-500 uppercase">{category}</h4>
                      <div className="space-y-2">
                        {topics.map(topic => (
                          <div
                            key={topic.id}
                            className={cn(
                              "p-3 rounded-md cursor-pointer transition-all",
                              selectedTopic?.id === topic.id
                                ? "bg-blue-600 text-white shadow-md"
                                : "bg-gray-50 hover:bg-gray-100"
                            )}
                            onClick={() => handleTopicSelect(topic)}
                          >
                            <div className="font-medium">{topic.title}</div>
                            <p className="text-xs opacity-80 truncate">
                              {formatTime(topic.start)} - {formatTime(topic.end)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback for when categorization fails
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold mb-2 text-gray-500">All Topics</h4>
                    {filteredTopics.map(topic => (
                      <div
                        key={topic.id}
                        className={cn(
                          "p-3 rounded-md cursor-pointer transition-all",
                          selectedTopic?.id === topic.id
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-gray-50 hover:bg-gray-100"
                        )}
                        onClick={() => handleTopicSelect(topic)}
                      >
                        <div className="font-medium">{topic.title || `Topic ${topic.id}`}</div>
                        <p className="text-xs opacity-80 truncate">
                          {formatTime(topic.start)} - {formatTime(topic.end)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              searchQuery ? (
                <div className="text-center py-8 text-gray-500">
                  No topics matched your search
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No topics available. Try processing the audio file again.
                </div>
              )
            )}
          </ScrollArea>
          
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Button 
                onClick={playPauseTopic}
                variant={isPlaying ? "destructive" : "default"}
                className="flex-1"
              >
                {isPlaying ? "Stop" : "Play Topic"}
              </Button>
              <Button onClick={onReset} variant="outline" className="flex-1">
                Upload Different Lecture
              </Button>
            </div>
          </div>
        </div>
        
        {/* Right panel - Selected topic details */}
        <div className="w-full md:w-2/3">
          {selectedTopic ? (
            <div id={`topic-section-${selectedTopic.id}`} className="scroll-mt-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">{selectedTopic.title}</h3>
                <div className="text-sm text-gray-500">
                  {formatTime(selectedTopic.start)} - {formatTime(selectedTopic.end)}
                </div>
              </div>
              
              <Card className="mb-6">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Description</h4>
                  <p>{selectedTopic.description}</p>
                </CardContent>
              </Card>
              
              <Tabs defaultValue="transcript">
                <TabsList>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                </TabsList>
                
                <TabsContent value="transcript" className="mt-4">
                  <Card>
                    <CardContent className="p-4">
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-4">
                          {/* Check if we have any segments */}
                          {selectedTopic.segments && selectedTopic.segments.length > 0 ? (
                            // We have segments, map them
                            selectedTopic.segments.map((segmentIndex) => {
                              const segment = transcriptData?.transcript?.segments?.[segmentIndex];
                              return segment ? (
                                <div key={segment.id || segmentIndex} className="pb-2 border-b border-gray-100">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-gray-500">
                                      {formatTime(segment.start)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => {
                                        if (audioProcessorRef.current) {
                                          audioProcessorRef.current.playSegment(segment.start, 30);
                                        }
                                      }}
                                    >
                                      Play Segment
                                    </Button>
                                  </div>
                                  <p className="text-sm">{segment.text}</p>
                                </div>
                              ) : null;
                            })
                          ) : (
                            // No segments, show descriptive text
                            <div className="text-center py-4 text-gray-500">
                              <p>No transcript segments are linked to this topic.</p>
                              <p className="text-xs mt-1">You can still play this topic using the Play button below.</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Select a topic to view its details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopicNavigator;
