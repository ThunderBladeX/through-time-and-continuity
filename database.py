import os
import httpx
import mimetypes

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL and SUPABASE_KEY not set. Database features will be limited.")
    SUPABASE_URL = ""
    SUPABASE_KEY = ""

# Simple HTTP client for Supabase REST API
class SupabaseClient:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key
        # Base headers for all requests
        self.base_headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
        }
    
    def query(self, table, method='GET', params=None, data=None, select='*'):
        """Make a request to Supabase REST API (for database tables)"""
        if not self.url or not self.key:
            return []
        
        url = f"{self.url}/rest/v1/{table}"
        
        headers = self.base_headers.copy()
        headers['Content-Type'] = 'application/json'
        headers['Prefer'] = 'return=representation'

        # Add select parameter for GET requests
        if method == 'GET':
            if params is None:
                params = {}
            params['select'] = select
        
        try:
            with httpx.Client() as client:
                if method == 'GET':
                    response = client.get(url, headers=headers, params=params)
                elif method == 'POST':
                    response = client.post(url, headers=headers, json=data, params={'select': select} if select else None)
                elif method == 'PATCH':
                    response = client.patch(url, headers=headers, json=data, params=params)
                elif method == 'DELETE':
                    response = client.delete(url, headers=headers, params=params)
                
                if response.status_code in [200, 201, 204]:
                    if response.status_code == 204:
                        return []
                    try:
                        return response.json()
                    except:
                        return []
                else:
                    print(f"Database error: {response.status_code} - {response.text}")
                    return []
        except Exception as e:
            print(f"Database query error: {e}")
            return []

    def upload_file(self, bucket_name, destination_path, file_body, content_type):
        """Upload a file to Supabase Storage"""
        if not self.url or not self.key:
            return None

        storage_url = f"{self.url}/storage/v1/object/{bucket_name}/{destination_path}"
        
        upload_headers = self.base_headers.copy()
        upload_headers['Content-Type'] = content_type

        try:
            with httpx.Client() as client:
                response = client.post(storage_url, headers=upload_headers, content=file_body)
                
                if response.status_code == 200:
                    # File uploaded successfully, now get the public URL
                    return self.get_public_url(bucket_name, destination_path)
                else:
                    print(f"Storage error: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"File upload error: {e}")
            return None
            
    def get_public_url(self, bucket_name, path):
        """Gets the public URL for a file in storage."""
        if not self.url:
            return None
        return f"{self.url}/storage/v1/object/public/{bucket_name}/{path}"

# Initialize client
supabase = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

# Database helper functions
class Database:
    @property
    def supabase(self):
        """Provide access to the raw SupabaseClient for storage operations"""
        return supabase
        
    @staticmethod
    def get_all_characters(family=None):
        """Get all characters, optionally filtered by family"""
        params = {'order': 'full_name'}
        if family and family != 'all':
            params['family'] = f'eq.{family}'
        
        return supabase.query('characters', params=params, select='*')
    
    @staticmethod
    def get_character_by_id(character_id):
        """Get a single character by ID"""
        params = {'id': f'eq.{character_id}'}
        result = supabase.query('characters', params=params, select='*')
        return result[0] if result else None
    
    @staticmethod
    def get_character_timeline(character_id):
        """Get all timeline events for a character"""
        params = {'character_id': f'eq.{character_id}'}
        event_chars = supabase.query('event_characters', params=params, select='event_id')
        
        if not event_chars:
            return []
        
        event_ids = [str(ec['event_id']) for ec in event_chars]
        if not event_ids:
            return []
        
        params = {'id': f'in.({",".join(event_ids)})', 'order': 'event_date'}
        events = supabase.query('events', params=params, select='*')
        return events
    
    @staticmethod
    def get_character_relationships(character_id):
        """Get all relationships for a character"""
        params = {'character_id': f'eq.{character_id}'}
        relationships = supabase.query('relationships', params=params, select='*')
        
        for rel in relationships:
            rel_char = Database.get_character_by_id(rel['related_character_id'])
            rel['related_character'] = rel_char if rel_char else {}
        
        return relationships
    
    @staticmethod
    def get_character_gallery(character_id):
        """Get all gallery images for a character"""
        params = {'character_id': f'eq.{character_id}', 'order': 'created_at.desc'}
        return supabase.query('gallery_images', params=params, select='*')
    
    @staticmethod
    def get_recent_events(limit=6):
        """Get recent timeline events"""
        params = {'order': 'event_date.desc', 'limit': limit}
        events = supabase.query('events', params=params, select='*')
        
        for event in events:
            params = {'event_id': f'eq.{event["id"]}'}
            event_chars = supabase.query('event_characters', params=params, select='character_id')
            event['event_characters'] = []
            
            for ec in event_chars:
                char = Database.get_character_by_id(ec['character_id'])
                if char:
                    event['event_characters'].append({
                        'character_id': ec['character_id'],
                        'characters': char
                    })
        
        return events
    
    @staticmethod
    def get_event_by_id(event_id):
        """Get a single event by ID"""
        params = {'id': f'eq.{event_id}'}
        result = supabase.query('events', params=params, select='*')
        
        if not result:
            return None
        
        event = result[0]
        
        params = {'event_id': f'eq.{event_id}'}
        event_chars = supabase.query('event_characters', params=params, select='character_id')
        event['event_characters'] = []
        
        for ec in event_chars:
            char = Database.get_character_by_id(ec['character_id'])
            if char:
                event['event_characters'].append({
                    'character_id': ec['character_id'],
                    'characters': char
                })
        
        params = {'event_id': f'eq.{event_id}'}
        images = supabase.query('event_images', params=params, select='image_url')
        event['images'] = [img['image_url'] for img in images] if images else []
        
        return event
    
    @staticmethod
    def create_character(data):
        """Create a new character"""
        # Remove empty fields before inserting
        clean_data = {k: v for k, v in data.items() if v}
        result = supabase.query('characters', method='POST', data=clean_data, select='*')
        return result[0] if result else None
    
    @staticmethod
    def update_character(character_id, data):
        """Update a character"""
        params = {'id': f'eq.{character_id}'}
        result = supabase.query('characters', method='PATCH', params=params, data=data)
        return result[0] if result else None
    
    @staticmethod
    def delete_character(character_id):
        """Delete a character and associated data"""
        # Delete relationships where this character is the primary or related character
        supabase.query('relationships', method='DELETE', params={'character_id': f'eq.{character_id}'})
        supabase.query('relationships', method='DELETE', params={'related_character_id': f'eq.{character_id}'})
        # Delete other associated data
        supabase.query('gallery_images', method='DELETE', params={'character_id': f'eq.{character_id}'})
        supabase.query('event_characters', method='DELETE', params={'character_id': f'eq.{character_id}'})
        # Finally, delete the character itself
        supabase.query('characters', method='DELETE', params={'id': f'eq.{character_id}'})
        return True
    
    @staticmethod
    def create_event(data):
        """Create a new timeline event"""
        clean_data = {k: v for k, v in data.items() if v}
        result = supabase.query('events', method='POST', data=clean_data, select='*')
        return result[0] if result else None
        
    @staticmethod
    def update_event(event_id, data):
        """Update a timeline event"""
        params = {'id': f'eq.{event_id}'}
        result = supabase.query('events', method='PATCH', params=params, data=data)
        return result[0] if result else None

    @staticmethod
    def delete_event(event_id):
        """Delete an event and its associated links/images"""
        params = {'event_id': f'eq.{event_id}'}
        supabase.query('event_characters', method='DELETE', params=params)
        supabase.query('event_images', method='DELETE', params=params)
        params = {'id': f'eq.{event_id}'}
        supabase.query('events', method='DELETE', params=params)
        return True

    @staticmethod
    def create_event_images(images_data):
        """Create multiple event image entries"""
        result = supabase.query('event_images', method='POST', data=images_data, select='*')
        return result

    @staticmethod
    def link_event_to_characters(event_id, character_ids):
        """Link an event to multiple characters"""
        links = [{'event_id': event_id, 'character_id': char_id} for char_id in character_ids]
        result = supabase.query('event_characters', method='POST', data=links, select='*')
        return result
    
    @staticmethod
    def create_relationship(data):
        """Create a new relationship"""
        result = supabase.query('relationships', method='POST', data=data, select='*')
        return result[0] if result else None
    
    @staticmethod
    def create_gallery_image(data):
        """Create a gallery image entry"""
        result = supabase.query('gallery_images', method='POST', data=data, select='*')
        return result[0] if result else None
    
    @staticmethod
    def get_pending_edits():
        """Get all pending edits"""
        params = {'status': 'eq.pending', 'order': 'created_at.desc'}
        return supabase.query('pending_edits', params=params, select='*')
    
    @staticmethod
    def get_all_relationships():
        """Get all relationships, populating character names"""
        relationships = supabase.query('relationships', select='*', params={'order': 'id'})
        if not relationships: return []
        characters = supabase.query('characters', select='id,full_name')
        char_map = {c['id']: c for c in characters}
        for rel in relationships:
            rel['character'] = char_map.get(rel['character_id'], {})
            rel['related_character'] = char_map.get(rel['related_character_id'], {})
        return relationships

    @staticmethod
    def get_all_gallery_images():
        """Get all gallery images, populating character names"""
        images = supabase.query('gallery_images', select='*', params={'order': 'created_at.desc'})
        if not images: return []
        characters = supabase.query('characters', select='id,full_name')
        char_map = {c['id']: c for c in characters}
        for img in images:
            img['character'] = char_map.get(img['character_id'], {})
        return images

    @staticmethod
    def approve_edit(edit_id):
        """Approve a pending edit"""
        params = {'id': f'eq.{edit_id}'}
        data = {'status': 'approved'}
        result = supabase.query('pending_edits', method='PATCH', params=params, data=data)
        return result[0] if result else None
    
    @staticmethod
    def deny_edit(edit_id):
        """Deny a pending edit"""
        params = {'id': f'eq.{edit_id}'}
        data = {'status': 'denied'}
        result = supabase.query('pending_edits', method='PATCH', params=params, data=data)
        return result[0] if result else None

db = Database()
