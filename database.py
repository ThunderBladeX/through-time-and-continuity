import os
import httpx
import mimetypes

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL and SUPABASE_KEY not set. Database features will be limited.")
    SUPABASE_URL = ""
    SUPABASE_KEY = ""

class SupabaseClient:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key

        self.base_headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Prefer': 'return=representation'
        }

    def query(self, table, method='GET', params=None, data=None, select='*'):
        """Make a request to Supabase REST API (for database tables)"""
        if not self.url or not self.key:
            print("ERROR: SUPABASE_URL or SUPABASE_KEY is missing.")
            return []

        url = f"{self.url}/rest/v1/{table}"

        headers = self.base_headers.copy()
        headers['Content-Type'] = 'application/json'
        headers['Prefer'] = 'return=representation'

        if method == 'GET':
            if params is None:
                params = {}
            params['select'] = select

        try:
            with httpx.Client() as client:
                print(f"Sending {method} request to {url}")
                if method == 'GET':
                    response = client.get(url, headers=headers, params=params)
                elif method == 'POST':
                    response = client.post(url, headers=headers, json=data, params={'select': select} if select else None)
                elif method == 'PATCH':
                    response = client.patch(url, headers=headers, json=data, params=params)
                elif method == 'DELETE':
                    response = client.delete(url, headers=headers, params=params)

                if 200 <= response.status_code < 300:
                    if response.status_code == 204: 
                        return []
                    return response.json()
                else:
                    print("--- SUPABASE DATABASE ERROR ---")
                    print(f"REQUEST: {method} {response.url}")
                    if data:
                        print(f"REQUEST BODY: {data}")
                    print(f"STATUS CODE: {response.status_code}")
                    print(f"RESPONSE BODY: {response.text}")
                    print("--- END OF ERROR ---")
                    return []
        except Exception as e:
            print(f"An exception occurred during the database query: {e}")
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

supabase = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

class Database:
    @property
    def supabase(self):
        """Provide access to the raw SupabaseClient for storage operations"""
        return supabase

    @staticmethod
    def get_all_eras():
        """Get all era definitions from the database"""
        eras = supabase.query('eras', select='id,name')
        return {era['id']: era['name'] for era in eras} if eras else {}

    @staticmethod
    def get_all_characters(family=None):
        """Get all characters, optionally filtered by family"""
        params = {'order': 'full_name'}
        if family and family != 'all':
            params['family'] = f'eq.{family}'

        return supabase.query('characters', params=params, select='*,family:families(slug,name)')

    @staticmethod
    def get_character_by_id(character_id):
        """Get a single character by ID, including their bio sections"""
        params = {'id': f'eq.{character_id}'}
        result = supabase.query('characters', params=params, select='*,family:families(slug,name)')

        if not result:
            return None

        character = result[0]

        bio_params = {'character_id': f'eq.{character_id}', 'order': 'display_order'}
        bio_sections = supabase.query('character_bio', params=bio_params, select='*')
        character['bio_sections'] = bio_sections if bio_sections else []

        return character

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
        result = supabase.query('characters', method='POST', data=data, select='*')
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

        supabase.query('relationships', method='DELETE', params={'character_id': f'eq.{character_id}'})
        supabase.query('relationships', method='DELETE', params={'related_character_id': f'eq.{character_id}'})

        supabase.query('love_interests', method='DELETE', params={'character_one_id': f'eq.{character_id}'})
        supabase.query('love_interests', method='DELETE', params={'character_two_id': f'eq.{character_id}'})

        supabase.query('gallery_images', method='DELETE', params={'character_id': f'eq.{character_id}'})
        supabase.query('event_characters', method='DELETE', params={'character_id': f'eq.{character_id}'})
        supabase.query('character_bio', method='DELETE', params={'character_id': f'eq.{character_id}'})

        supabase.query('characters', method='DELETE', params={'id': f'eq.{character_id}'})
        return True

    @staticmethod
    def update_character_bio_sections(character_id, sections_data):
        """Deletes all existing bio sections and inserts the new ones for a character."""
        if not character_id:
            return False

        supabase.query('character_bio', method='DELETE', params={'character_id': f'eq.{character_id}'})

        if not sections_data:
            return True 

        sections_to_insert = []
        for i, section in enumerate(sections_data):

            if section.get('section_title') and section.get('content'):
                sections_to_insert.append({
                    'character_id': character_id,
                    'section_title': section.get('section_title'),
                    'content': section.get('content'),
                    'display_order': i
                })

        if not sections_to_insert:
            return True

        result = supabase.query('character_bio', method='POST', data=sections_to_insert, select='id')

        return bool(result)

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
        clean_data = {k: v for k, v in data.items() if v}
        result = supabase.query('events', method='PATCH', params=params, data=clean_data)
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
    def delete_gallery_image(image_id):
        """Delete a gallery image from DB and Storage"""
        params = {'id': f'eq.{image_id}'}
        result = supabase.query('gallery_images', params=params, select='*')
        
        if not result:
            return False
            
        image_record = result[0]
        image_url = image_record.get('image_url', '')

        supabase.query('gallery_images', method='DELETE', params=params)

        if image_url and 'gallery-images' in image_url:
            try:
                path = image_url.split('/gallery-images/')[-1]
                supabase.delete_file('gallery-images', path)
            except Exception as e:
                print(f"Error parsing URL for deletion: {e}")

        return True

    @staticmethod
    def link_event_to_characters(event_id, character_ids):
        """Link an event to multiple characters"""
        if not character_ids:
            return []
        links = [{'event_id': event_id, 'character_id': char_id} for char_id in character_ids]
        result = supabase.query('event_characters', method='POST', data=links, select='*')
        return result

    @staticmethod
    def update_event_character_links(event_id, character_ids):
        """Deletes all existing character links for an event and creates new ones."""

        supabase.query('event_characters', method='DELETE', params={'event_id': f'eq.{event_id}'})

        return Database.link_event_to_characters(event_id, character_ids)

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
        characters = supabase.query('characters', select='id,name')
        char_map = {c['id']: c for c in characters}
        for rel in relationships:
            rel['character'] = char_map.get(rel['character_id'], {})
            rel['related_character'] = char_map.get(rel['related_character_id'], {})
        return relationships

    def get_relationship_pair(self, char1_id, char2_id):
        """Get both sides of a relationship."""

        params_a = {'character_id': f'eq.{char1_id}', 'related_character_id': f'eq.{char2_id}'}
        a_to_b = supabase.query('relationships', params=params_a, select='*')

        params_b = {'character_id': f'eq.{char2_id}', 'related_character_id': f'eq.{char1_id}'}
        b_to_a = supabase.query('relationships', params=params_b, select='*')

        if not a_to_b or not b_to_a:
            return None

        char1 = self.get_character_by_id(char1_id)
        char2 = self.get_character_by_id(char2_id)

        a_to_b[0]['character'] = char1
        b_to_a[0]['character'] = char2

        return {'a_to_b': a_to_b[0], 'b_to_a': b_to_a[0]}

    def delete_relationship_pair(self, char1_id, char2_id):
        """Delete both sides of a relationship."""

        params_a = {'character_id': f'eq.{char1_id}', 'related_character_id': f'eq.{char2_id}'}
        supabase.query('relationships', method='DELETE', params=params_a)

        params_b = {'character_id': f'eq.{char2_id}', 'related_character_id': f'eq.{char1_id}'}
        supabase.query('relationships', method='DELETE', params=params_b)
        return True

    def update_relationship_pair(self, data):
        """Update both sides of an asymmetrical relationship."""
        char1_id = data.get('character_id')
        char2_id = data.get('related_character_id')

        params_a = {'character_id': f'eq.{char1_id}', 'related_character_id': f'eq.{char2_id}'}
        data_a = {'type': data.get('type'), 'status': data.get('status_a_to_b') or None}
        updated_a = supabase.query('relationships', method='PATCH', params=params_a, data=data_a)

        params_b = {'character_id': f'eq.{char2_id}', 'related_character_id': f'eq.{char1_id}'}
        data_b = {'type': data.get('type'), 'status': data.get('status_b_to_a') or None}
        supabase.query('relationships', method='PATCH', params=params_b, data=data_b)

        return updated_a[0] if updated_a else None

    @staticmethod
    def get_all_gallery_images():
        """Get all gallery images, populating character names"""
        images = supabase.query('gallery_images', select='*', params={'order': 'created_at.desc'})
        if not images: return []
        characters = supabase.query('characters', select='id,name')
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

    @staticmethod
    def get_all_families():
        """Get all family definitions from the database"""
        return supabase.query('families', params={'order': 'name'}, select='*')

    @staticmethod
    def get_character_love_interests(character_id):
        """Get all love interests for a character."""
        params = {'or': f'(character_one_id.eq.{character_id},character_two_id.eq.{character_id})'}

        select_query = '*,character_one:character_one_id(id,name,profile_image),character_two:character_two_id(id,name,profile_image)'
        interests = supabase.query('love_interests', params=params, select=select_query)

        formatted = []
        for interest in interests:
            is_char_one_in_db = interest['character_one_id'] == character_id

            if is_char_one_in_db:
                partner = interest.get('character_two', {})
                description = interest.get('description_one_to_two')
            else:
                partner = interest.get('character_one', {})
                description = interest.get('description_two_to_one')

            formatted.append({
                'id': interest['id'],
                'category': interest['category'],
                'partner': partner,
                'description': description
            })
        return formatted

    @staticmethod
    def get_all_love_interests():
        """Get all love interests for the admin panel."""

        select_query = '*,character_one:character_one_id(id,name),character_two:character_two_id(id,name)'
        return supabase.query('love_interests', params={'order': 'created_at.desc'}, select=select_query)

    @staticmethod
    def get_love_interest_by_id(interest_id):
        """Get a single love interest by its ID."""
        params = {'id': f'eq.{interest_id}'}
        result = supabase.query('love_interests', params=params, select='*')
        return result[0] if result else None

    @staticmethod
    def create_love_interest(data):
        """Create a new love interest."""
        char1 = int(data.get('character_one_id'))
        char2 = int(data.get('character_two_id'))

        insert_data = {
            'category': data.get('category')
        }

        if char1 < char2:
            insert_data['character_one_id'] = char1
            insert_data['character_two_id'] = char2
            insert_data['description_one_to_two'] = data.get('description_one_to_two')
            insert_data['description_two_to_one'] = data.get('description_two_to_one')
        else:
            insert_data['character_one_id'] = char2
            insert_data['character_two_id'] = char1

            insert_data['description_one_to_two'] = data.get('description_two_to_one')
            insert_data['description_two_to_one'] = data.get('description_one_to_two')

        result = supabase.query('love_interests', method='POST', data=insert_data, select='*')
        return result[0] if result else None

    @staticmethod
    def update_love_interest(interest_id, data):
        """Update a love interest."""
        params = {'id': f'eq.{interest_id}'}

        update_data = {
            'category': data.get('category'),
            'description_one_to_two': data.get('description_one_to_two'),
            'description_two_to_one': data.get('description_two_to_one')
        }
        result = supabase.query('love_interests', method='PATCH', params=params, data=update_data)
        return result[0] if result else None

    @staticmethod
    def delete_love_interest(interest_id):
        """Delete a love interest."""
        params = {'id': f'eq.{interest_id}'}
        supabase.query('love_interests', method='DELETE', params=params)
        return True

db = Database()
