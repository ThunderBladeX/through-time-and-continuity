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
    def get_character_love_interests(character_id):
        """Get all love interests for a character, formatted for display."""
        params = {'or': f'(character_id_1.eq.{character_id},character_id_2.eq.{character_id})'}

        select_query = '*,character1:characters!character_id_1(id, name, profile_image),character2:characters!character_id_2(id, name, profile_image)'
        interests = supabase.query('love_interests', params=params, select=select_query)

        formatted = []
        for item in interests:

            if item['character_id_1'] == character_id:
                other_char = item.get('character2', {})
                description = item.get('description_2_to_1') 
            else:
                other_char = item.get('character1', {})
                description = item.get('description_1_to_2') 

            if not other_char:
                continue

            formatted.append({
                'id': item['id'],
                'category': item['category'],
                'related_character_id': other_char.get('id'),
                'related_character_name': other_char.get('name'),
                'related_character_image': other_char.get('profile_image'),
                'description': description
            })
        return formatted

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

        supabase.query('love_interests', method='DELETE', params={'or': f'(character_id_1.eq.{character_id},character_id_2.eq.{character_id})'})

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
    def get_all_love_interests():
        """Gets all love interests for the admin panel."""
        select_query = '*,character1:characters!character_id_1(id,name),character2:characters!character_id_2(id,name)'
        return supabase.query('love_interests', select=select_query, params={'order': 'id'})

    @staticmethod
    def create_love_interest(data):
        """Creates a new love interest pair."""
        result = supabase.query('love_interests', method='POST', data=data, select='*')
        return result[0] if result else None

    @staticmethod
    def update_love_interest(interest_id, data):
        """Updates a love interest pair."""
        params = {'id': f'eq.{interest_id}'}
        result = supabase.query('love_interests', method='PATCH', params=params, data=data)
        return result[0] if result else None

    @staticmethod
    def delete_love_interest(interest_id):
        """Deletes a love interest pair."""
        params = {'id': f'eq.{interest_id}'}
        supabase.query('love_interests', method='DELETE', params=params)
        return True

db = Database()```
---

I've added the new public and admin API endpoints for "Love Interests".

```python
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_jwt_extended import create_access_token, jwt_required, JWTManager
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import os
import markdown as md
from datetime import datetime, timedelta
import json
from database import db, Database
import mimetypes

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'secret-jwt-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)
app.config['SECRET_KEY'] = os.getenv('SESSION_SECRET', 'dev-secret-key')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  

jwt = JWTManager(app)

ERA_NAMES = {}
try:
    with app.app_context():
        ERA_NAMES = db.get_all_eras()
except Exception as e:
    print(f"Initial ERA_NAMES load from database failed: {e}")

if not ERA_NAMES:
    print("Warning: Could not load ERA_NAMES from database. Using fallback.")
    ERA_NAMES = {
        'pre-52': 'Classic',
        'new-52': 'New 52',
        'rebirth': 'Rebirth',
        'infinite-frontier': 'Infinite Frontier',
        'elseworlds': 'Elseworlds',
        'post-crisis': 'Post-Crisis',
        'future-state': 'Future State'
    }

def clean_form_data(data):
    """Helper function to convert empty strings for specific fields to None."""
    if 'birthday' in data and data['birthday'] == '':
        data['birthday'] = None

    return data

print(f"DB: {db}.")
print(f"Type: {type(db)}.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/characters')
def characters():
    return render_template('characters.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/profile/<int:character_id>')
def profile(character_id):
    return render_template('profile.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/api/characters')
def api_characters():
    family = request.args.get('family', 'all')
    characters = db.get_all_characters(family)
    return jsonify(characters)

@app.route('/api/characters/<int:character_id>')
def api_character_detail(character_id):
    character = db.get_character_by_id(character_id)
    if not character:
        return jsonify({'error': 'Character not found'}), 404
    return jsonify(character)

@app.route('/api/characters/<int:character_id>/timeline')
def api_character_timeline(character_id):
    events = db.get_character_timeline(character_id)
    for event in events:
        event['era_display'] = ERA_NAMES.get(event.get('era', ''), event.get('era', ''))
    return jsonify(events)

@app.route('/api/characters/<int:character_id>/relationships')
def api_character_relationships(character_id):
    relationships = db.get_character_relationships(character_id)
    formatted = []
    for rel in relationships:
        related = rel.get('related_character', {})
        formatted.append({
            'id': rel['id'],
            'type': rel['type'],
            'status': rel['status'],
            'related_character_id': rel['related_character_id'],
            'related_character_name': related.get('name', ''),
            'related_character_image': related.get('profile_image', '/static/images/default-avatar.jpg')
        })
    return jsonify(formatted)

@app.route('/api/characters/<int:character_id>/love-interests')
def api_character_love_interests(character_id):
    """NEW: Get love interests for a character."""
    love_interests = db.get_character_love_interests(character_id)
    return jsonify(love_interests)

@app.route('/api/characters/<int:character_id>/gallery')
def api_character_gallery(character_id):
    images = db.get_character_gallery(character_id)
    formatted = [{'url': img['image_url'], 'alt': img.get('alt_text', '')} for img in images]
    return jsonify(formatted)

@app.route('/api/events')
def api_events():
    limit = int(request.args.get('limit', 6))
    events = db.get_recent_events(limit)
    formatted = []
    for event in events:
        event_chars = event.get('event_characters', [])
        first_char = event_chars[0]['characters'] if event_chars else {}
        formatted.append({
            'id': event['id'],
            'title': event['title'],
            'event_date': event['event_date'],
            'era': event['era'],
            'era_display': ERA_NAMES.get(event['era'], event['era']),
            'summary': event['summary'],
            'character_id': event_chars[0]['character_id'] if event_chars else None,
            'character_name': first_char.get('name', ''),
            'character_image': first_char.get('profile_image', '/static/images/default-avatar.jpg'),
            'characters': [ec['characters']['name'] for ec in event_chars if 'characters' in ec]
        })
    return jsonify(formatted)

@app.route('/api/events/<int:event_id>')
def api_event_detail(event_id):
    event = db.get_event_by_id(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    event['era_display'] = ERA_NAMES.get(event.get('era', ''), event.get('era', ''))
    if event.get('full_description'):
        event['full_description'] = md.markdown(event['full_description'])
    return jsonify(event)

@app.route('/api/families')
def api_families():
    families = db.get_all_families()
    return jsonify(families)

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return jsonify({"message": "Invalid JSON format"}), 400
    if not data:
        return jsonify({"message": "No input data provided"}), 400
    username = data.get('username')
    password = data.get('password')
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    admin_password_hash = os.getenv('ADMIN_PASSWORD')
    if not admin_password_hash:
        admin_password_hash = 'pbkdf2:sha256:600000$QOlgUXyHBQdPQTyQ$a6f40e9034b4ff7744f08a2e7f106141c490e8119bab8fb63751a65a5f91eb6d'
        print("WARNING: ADMIN_PASSWORD env var not set. Using insecure fallback.")
    if username == admin_username and check_password_hash(admin_password_hash, password):
        access_token = create_access_token(identity=username)
        return jsonify(access_token=access_token)
    return jsonify({"message": "Invalid username or password"}), 401

@app.route('/api/logout', methods=['POST'])
@jwt_required()
def api_logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/api/admin/pending-edits', methods=['GET'])
@jwt_required()
def api_get_pending_edits():
    return jsonify(db.get_pending_edits())

@app.route('/api/admin/pending-edits/<int:edit_id>', methods=['PATCH'])
@jwt_required()
def api_update_pending_edit(edit_id):
    action = request.json.get('action')
    if action == 'approve':
        edit = db.approve_edit(edit_id)
        return jsonify(edit) if edit else (jsonify({'error': 'Failed to approve edit'}), 400)
    elif action == 'deny':
        edit = db.deny_edit(edit_id)
        return jsonify(edit) if edit else (jsonify({'error': 'Failed to deny edit'}), 400)
    return jsonify({'error': 'Invalid action'}), 400

@app.route('/api/admin/relationships', methods=['GET'])
@jwt_required()
def api_get_all_relationships():
    return jsonify(db.get_all_relationships())

@app.route('/api/admin/relationships', methods=['POST', 'PATCH'])
@jwt_required()
def api_manage_relationships():
    data = request.get_json()
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid JSON format in request body'}), 400
    if not data or 'character_id' not in data or 'related_character_id' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    if request.method == 'POST':
        char_id_a = data.get('character_id')
        char_id_b = data.get('related_character_id')

        data_a_to_b = {
            'character_id': char_id_a,
            'related_character_id': char_id_b,
            'type': data.get('type'),
            'status': data.get('status_a_to_b') or None
        }
        data_b_to_a = {
            'character_id': char_id_b,
            'related_character_id': char_id_a,
            'type': data.get('type'),
            'status': data.get('status_b_to_a') or None
        }

        relationship_a = db.create_relationship(data_a_to_b)
        db.create_relationship(data_b_to_a)

        if relationship_a:
            return jsonify(relationship_a), 201
        else:
            return jsonify({'error': 'Failed to create relationship'}), 500

    elif request.method == 'PATCH':
        updated = db.update_relationship_pair(data)
        if updated:
            return jsonify(updated), 200
        return jsonify({'error': 'Failed to update relationship'}), 500

@app.route('/api/admin/relationships/<int:char1_id>/<int:char2_id>', methods=['GET', 'DELETE'])
@jwt_required()
def api_manage_relationship_pair(char1_id, char2_id):
    if request.method == 'GET':
        pair_data = db.get_relationship_pair(char1_id, char2_id)
        if not pair_data:
            return jsonify({'error': 'Relationship not found'}), 404
        return jsonify(pair_data)

    elif request.method == 'DELETE':
        success = db.delete_relationship_pair(char1_id, char2_id)
        if success:
            return jsonify({'success': True}), 200
        return jsonify({'error': 'Failed to delete relationship'}), 500

@app.route('/api/admin/love-interests', methods=['GET'])
@jwt_required()
def api_get_all_love_interests():
    """Admin endpoint to get all love interests."""
    return jsonify(db.get_all_love_interests())

@app.route('/api/admin/love-interests', methods=['POST'])
@jwt_required()
def api_create_love_interest():
    """Admin endpoint to create a new love interest."""
    data = request.get_json()
    if not data or 'character_id_1' not in data or 'character_id_2' not in data or 'category' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    data['description_1_to_2'] = data.get('description_1_to_2') or None
    data['description_2_to_1'] = data.get('description_2_to_1') or None

    new_interest = db.create_love_interest(data)
    return (jsonify(new_interest), 201) if new_interest else (jsonify({'error': 'Failed to create love interest'}), 500)

@app.route('/api/admin/love-interests/<int:interest_id>', methods=['PUT'])
@jwt_required()
def api_update_love_interest(interest_id):
    """Admin endpoint to update a love interest."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    data['description_1_to_2'] = data.get('description_1_to_2') or None
    data['description_2_to_1'] = data.get('description_2_to_1') or None

    updated = db.update_love_interest(interest_id, data)
    return (jsonify(updated), 200) if updated else (jsonify({'error': 'Failed to update love interest'}), 500)

@app.route('/api/admin/love-interests/<int:interest_id>', methods=['DELETE'])
@jwt_required()
def api_delete_love_interest(interest_id):
    """Admin endpoint to delete a love interest."""
    success = db.delete_love_interest(interest_id)
    return (jsonify({'success': True}), 200) if success else (jsonify({'error': 'Failed to delete love interest'}), 500)

@app.route('/api/admin/gallery', methods=['GET'])
@jwt_required()
def api_get_all_gallery_images():
    return jsonify(db.get_all_gallery_images())

@app.route('/api/admin/characters', methods=['POST'])
@jwt_required()
def api_create_character():
    data = request.form.to_dict()
    bio_sections_json = data.pop('bio_sections', None)
    data = clean_form_data(data)

    print(f"Attempting to create character with data: {data}")
    if 'profile_image' in request.files:
        file = request.files['profile_image']
        if file and file.filename:
            filename = secure_filename(file.filename)
            unique_filename = f"profiles/{int(datetime.now().timestamp())}_{filename}"
            content_type = file.mimetype or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            bucket_name = 'character-images' 
            file_body = file.read()
            public_url = db.supabase.upload_file(bucket_name, unique_filename, file_body, content_type)
            if public_url:
                data['profile_image'] = public_url
            else:
                return jsonify({'error': 'Failed to upload image to storage'}), 500

    character = db.create_character(data)

    if character:
        if bio_sections_json:
            try:
                bio_sections_data = json.loads(bio_sections_json)
                db.update_character_bio_sections(character['id'], bio_sections_data)
            except json.JSONDecodeError:
                print("Warning: Could not decode bio_sections JSON.")
        return jsonify(character), 201
    else:
        print("db.create_character returned None. Character creation failed in database.py.")
        return jsonify({'error': 'Failed to create character in database'}), 500

@app.route('/api/admin/characters/<int:character_id>', methods=['PUT'])
@jwt_required()
def api_update_character(character_id):
    data = request.form.to_dict()
    bio_sections_json = data.pop('bio_sections', None)
    data = clean_form_data(data)
    print(f"Received data for updating character {character_id}: {data}")

    if 'profile_image' in request.files:
        file = request.files['profile_image']
        if file and file.filename:
            filename = secure_filename(file.filename)
            unique_filename = f"profiles/{int(datetime.now().timestamp())}_{filename}"
            content_type = file.mimetype or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            bucket_name = 'character-images'
            file_body = file.read()
            public_url = db.supabase.upload_file(bucket_name, unique_filename, file_body, content_type)
            if public_url:
                data['profile_image'] = public_url
            else:
                return jsonify({'error': 'Failed to upload image'}), 500

    character = db.update_character(character_id, data)

    if bio_sections_json is not None:
        try:
            bio_sections_data = json.loads(bio_sections_json)
            db.update_character_bio_sections(character_id, bio_sections_data)
        except json.JSONDecodeError:
            print(f"Warning: Could not decode bio_sections JSON for character {character_id}.")

    return (jsonify(character), 200) if character else (jsonify({'error': 'Failed to update character. Check for empty required fields.'}), 500)

@app.route('/api/admin/characters/<int:character_id>', methods=['DELETE'])
@jwt_required()
def api_delete_character(character_id):
    db.delete_character(character_id)
    return jsonify({'success': True}), 200

@app.route('/api/admin/events', methods=['POST'])
@jwt_required()
def api_create_event():
    data = request.form.to_dict()
    character_ids_str = data.pop('character_ids', '')
    data.pop('character_ids_select', None)
    event = db.create_event(data)
    if not event:
        return jsonify({'error': 'Failed to create event'}), 500
    event_id = event['id']
    if character_ids_str:
        character_ids = [int(id) for id in character_ids_str.split(',') if id.isdigit()]
        if character_ids:
            db.link_event_to_characters(event_id, character_ids)
    images = request.files.getlist('event_images')
    image_urls = []
    bucket_name = 'event-images'
    for file in images:
        if file and file.filename:
            filename = secure_filename(file.filename)
            unique_filename = f"{event_id}/{int(datetime.now().timestamp())}_{filename}"
            content_type = file.mimetype or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            file_body = file.read()
            public_url = db.supabase.upload_file(bucket_name, unique_filename, file_body, content_type)
            if public_url:
                image_urls.append({'event_id': event_id, 'image_url': public_url})
    if image_urls:
        db.create_event_images(image_urls)
    return jsonify(event), 201

@app.route('/api/admin/events/<int:event_id>', methods=['PUT'])
@jwt_required()
def api_update_event(event_id):
    data = request.form.to_dict()
    character_ids_str = data.pop('character_ids', '')
    data.pop('character_ids_select', None)

    event = db.update_event(event_id, data)
    if not event:
        return jsonify({'error': 'Failed to update event'}), 500

    character_ids = [int(id) for id in character_ids_str.split(',') if id.isdigit()]
    db.update_event_character_links(event_id, character_ids)

    images = request.files.getlist('event_images')
    image_urls = []
    bucket_name = 'event-images'
    for file in images:
        if file and file.filename:
            filename = secure_filename(file.filename)
            unique_filename = f"{event_id}/{int(datetime.now().timestamp())}_{filename}"
            content_type = file.mimetype or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            file_body = file.read()
            public_url = db.supabase.upload_file(bucket_name, unique_filename, file_body, content_type)
            if public_url:
                image_urls.append({'event_id': event_id, 'image_url': public_url})
    if image_urls:
        db.create_event_images(image_urls)

    return jsonify(event), 200

@app.route('/api/admin/events/<int:event_id>', methods=['DELETE'])
@jwt_required()
def api_delete_event(event_id):
    db.delete_event(event_id)
    return jsonify({'success': True}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
