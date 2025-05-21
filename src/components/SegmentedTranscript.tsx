import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptionSegment } from "@/types/lecture";
import { formatTime } from "@/utils/format";
import { AudioProcessor } from "@/lib/audio";
import { Search } from 'lucide-react';

interface SegmentedTranscriptProps {
  segments: TranscriptionSegment[];
  audioProcessor?: AudioProcessor | null;
}

const SegmentedTranscript: React.FC<SegmentedTranscriptProps> = ({ 
  segments, 
  audioProcessor 
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Filter segments based on search query
  const filteredSegments = searchQuery 
    ? segments.filter(segment => 
        segment.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  // Helper function to highlight matching text
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <span key={i} className="bg-yellow-200 font-medium">{part}</span> 
        : part
    );
  };

  // Play a specific segment
  const playSegment = (segment: TranscriptionSegment) => {
    if (!audioProcessor) {
      console.warn('Audio processor not available for playback');
      return;
    }
    
    const duration = segment.end - segment.start;
    audioProcessor.playSegment(segment.start, duration);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        {searchQuery && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSearchQuery('')}
          >
            Clear
          </Button>
        )}
      </div>
      
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {filteredSegments.length} segment{filteredSegments.length !== 1 ? 's' : ''} 
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            {searchQuery && filteredSegments.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => playSegment(filteredSegments[0])}
              >
                Play First Match
              </Button>
            )}
          </div>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {filteredSegments.length > 0 ? (
                filteredSegments.map((segment) => (
                  <div 
                    key={segment.id} 
                    className="border-b border-border pb-3 last:border-0"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => playSegment(segment)}
                      >
                        Play
                      </Button>
                    </div>
                    <p className="text-sm">
                      {searchQuery
                        ? highlightText(segment.text, searchQuery)
                        : segment.text
                      }
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "No segments found matching your search"
                    : "No transcript segments available"}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SegmentedTranscript;
