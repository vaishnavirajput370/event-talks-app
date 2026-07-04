import os
import re
import requests
import feedparser
from flask import Flask, render_template, jsonify

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_updates_from_summary(summary):
    # Split by h3 tags, capturing the tags themselves
    parts = re.split(r'(<h3>.*?</h3>)', summary)
    
    updates = []
    
    # If the summary doesn't start with h3, there might be text before the first h3
    first_index = 0
    if parts and parts[0].strip():
        content = parts[0].strip()
        if content:
            updates.append({
                'type': 'General',
                'content': content
            })
        first_index = 1
    elif parts and not parts[0].strip():
        first_index = 1
        
    i = first_index
    while i < len(parts):
        header_tag = parts[i].strip()
        header_match = re.search(r'<h3>(.*?)</h3>', header_tag, re.IGNORECASE)
        update_type = header_match.group(1).strip() if header_match else "General"
        
        content = ""
        if i + 1 < len(parts):
            content = parts[i+1].strip()
            
        if update_type or content:
            updates.append({
                'type': update_type,
                'content': content
            })
        i += 2
        
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        # Fetch the feed
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Parse the feed
        feed = feedparser.parse(response.content)
        
        all_updates = []
        for entry in feed.entries:
            title = entry.get('title', 'No Date')
            link = entry.get('link', '')
            summary = entry.get('summary', '') or entry.get('description', '')
            published = entry.get('updated', '') or entry.get('published', '')
            entry_id = entry.get('id', link)
            
            # Split this entry's summary by h3 headers
            split_updates = parse_updates_from_summary(summary)
            
            for idx, update in enumerate(split_updates):
                update_id = f"{entry_id}_{idx}"
                all_updates.append({
                    'id': update_id,
                    'date': title,  # e.g., "July 01, 2026"
                    'link': link,
                    'type': update['type'],
                    'content': update['content'],
                    'published': published
                })
            
        return jsonify({
            'status': 'success',
            'title': feed.feed.get('title', 'BigQuery Release Notes'),
            'subtitle': feed.feed.get('subtitle', 'Latest updates from Google Cloud BigQuery'),
            'updated': feed.feed.get('updated', ''),
            'entries': all_updates
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
