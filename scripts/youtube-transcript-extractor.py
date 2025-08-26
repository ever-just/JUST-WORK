#!/usr/bin/env python3
"""
YouTube Transcript Extractor and Blog Outline Generator
Extracts transcript from YouTube video and creates a blog-style outline
"""

import sys
import json
import re
from typing import List, Dict, Any

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print("Installing required package: youtube-transcript-api")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "youtube-transcript-api"])
    from youtube_transcript_api import YouTubeTranscriptApi

def extract_video_id(url: str) -> str:
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\n?#]+)',
        r'youtube\.com/watch\?.*v=([^&\n?#]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    # If no pattern matches, assume the input is already a video ID
    return url

def get_transcript(video_id: str) -> str:
    """Get transcript from YouTube video"""
    try:
        # Try to get transcript in English first
        transcript_list = YouTubeTranscriptApi().fetch(video_id, languages=['en'])
        
        # Combine transcript text
        full_transcript = ' '.join([entry.text for entry in transcript_list])
        
        return full_transcript
    
    except Exception as e:
        try:
            # Try to get any available transcript
            transcript_list = YouTubeTranscriptApi().fetch(video_id)
            full_transcript = ' '.join([entry.text for entry in transcript_list])
            return full_transcript
        except Exception as e2:
            print(f"Error getting transcript: {e2}")
            return None

def clean_transcript(transcript: str) -> str:
    """Clean up transcript text"""
    if not transcript:
        return ""
    
    # Remove extra whitespace and normalize
    cleaned = re.sub(r'\s+', ' ', transcript.strip())
    
    # Remove common transcript artifacts
    cleaned = re.sub(r'\[.*?\]', '', cleaned)  # Remove [Music], [Applause], etc.
    cleaned = re.sub(r'\(.*?\)', '', cleaned)  # Remove parenthetical notes
    
    return cleaned.strip()

def create_blog_outline(transcript: str, video_url: str) -> str:
    """Create a blog-style outline from transcript"""
    
    # Split transcript into sentences
    sentences = re.split(r'[.!?]+', transcript)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    # Group sentences into paragraphs (roughly every 3-5 sentences)
    paragraphs = []
    current_paragraph = []
    
    for i, sentence in enumerate(sentences):
        current_paragraph.append(sentence)
        if len(current_paragraph) >= 4 or i == len(sentences) - 1:
            paragraphs.append(' '.join(current_paragraph))
            current_paragraph = []
    
    # Create outline structure
    outline = f"""# Video Transcript Analysis and Outline

**Source Video:** {video_url}

## Introduction

{paragraphs[0] if paragraphs else "No transcript content available."}

## Main Content Points

"""
    
    # Add main content sections
    for i, paragraph in enumerate(paragraphs[1:], 1):
        outline += f"### Section {i}\n\n{paragraph}\n\n"
    
    outline += """## Key Takeaways

Based on the transcript analysis, the main points discussed include:

"""
    
    # Extract potential key phrases (words that appear multiple times)
    words = re.findall(r'\b\w+\b', transcript.lower())
    word_freq = {}
    for word in words:
        if len(word) > 4:  # Only consider longer words
            word_freq[word] = word_freq.get(word, 0) + 1
    
    # Get top frequent words as potential key topics
    top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]
    
    for word, freq in top_words:
        if freq > 2:  # Only include words that appear more than twice
            outline += f"- **{word.capitalize()}** (mentioned {freq} times)\n"
    
    outline += f"""
## Conclusion

This video covers various topics as outlined above. The transcript provides insights into the speaker's main points and discussion themes.

---

*Note: This outline was automatically generated from the video transcript. Some context and nuances may be lost in the automated analysis.*
"""
    
    return outline

def main():
    video_url = "https://www.youtube.com/watch?v=5zFUBD2rRis"
    
    print(f"Extracting transcript from: {video_url}")
    
    # Extract video ID
    video_id = extract_video_id(video_url)
    print(f"Video ID: {video_id}")
    
    # Get transcript
    print("Fetching transcript...")
    transcript = get_transcript(video_id)
    
    if not transcript:
        print("Could not retrieve transcript. The video may not have captions available.")
        return
    
    # Clean transcript
    cleaned_transcript = clean_transcript(transcript)
    print(f"Transcript length: {len(cleaned_transcript)} characters")
    
    # Create outline
    print("Creating blog-style outline...")
    outline = create_blog_outline(cleaned_transcript, video_url)
    
    # Save results
    output_file = "/Users/cloudaistudio/Documents/EVERJUST PROJECTS/JUST-WORK/youtube_transcript_outline.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(outline)
    
    print(f"Blog outline saved to: {output_file}")
    print("\n" + "="*50)
    print("BLOG OUTLINE PREVIEW:")
    print("="*50)
    print(outline[:1000] + "..." if len(outline) > 1000 else outline)

if __name__ == "__main__":
    main()
