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

def load_era_names():
    """
    Loads eras from the database to map slugs (e.g., 'new-52') to Names (e.g., 'The New 52').
    This is run at startup to cache the values for display.
    """
    global ERA_NAMES
    try:

        eras = db.supabase.query('eras', select='slug,name')
        if eras:

            ERA_NAMES = {era['slug']: era['name'] for era in eras}
            print(f"Loaded {len(ERA_NAMES)} eras from database.")
        else:
            print("Warning: Eras table is empty.")
    except Exception as e:
        print(f"Initial ERA_NAMES load from database failed: {e}")

with app.app_context():
    load_era_names()

if not ERA_NAMES:
    ERA_NAMES = {
        'pre-crisis': 'Pre-Crisis',
        'post-crisis': 'Post-Crisis',
        'new-52': 'The New 52',
        'rebirth': 'DC Rebirth',
        'infinite-frontier': 'Infinite Frontier'
    }

def clean_form_data(data):
    """Helper function to convert empty strings for specific fields to None."""
    if 'birthday' in data and data['birthday'] == '':
        data['birthday'] = None
    return data

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
        era_slug = event.get('era')
        event['era_display'] = ERA_NAMES.get(era_slug, era_slug)
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

@app.route('/api/characters/<int:character_id>/gallery')
def api_character_gallery(character_id):
    images = db.get_character_gallery(character_id)
    formatted = [{'url': img['image_url'], 'alt': img.get('alt_text', '')} for img in images]
    return jsonify(formatted)

@app.route('/api/characters/<int:character_id>/love-interests')
def api_character_love_interests(character_id):
    interests = db.get_character_love_interests(character_id)
    return jsonify(interests)

@app.route('/api/events')
def api_events():
    limit = int(request.args.get('limit', 6))
    events = db.get_recent_events(limit)
    formatted = []
    for event in events:
        event_chars = event.get('event_characters', [])
        first_char = event_chars[0]['characters'] if event_chars else {}

        era_slug = event.get('era')

        formatted.append({
            'id': event['id'],
            'title': event['title'],
            'event_date': event['event_date'],
            'era': era_slug,
            'era_display': ERA_NAMES.get(era_slug, era_slug),
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

    era_slug = event.get('era')
    event['era_display'] = ERA_NAMES.get(era_slug, era_slug)

    if event.get('full_description'):
        event['full_description'] = md.markdown(event['full_description'])
    return jsonify(event)

@app.route('/api/families')
def api_families():

    families = db.get_all_families()
    return jsonify(families)

@app.route('/api/eras')
def api_eras_list():

    eras = db.supabase.query('eras', params={'order': 'display_order'}, select='slug,name')
    return jsonify(eras)

@app.route('/api/relationship-types')
def api_relationship_types():

    types = db.supabase.query('relationship_types', params={'order': 'name'}, select='slug,name')
    return jsonify(types)

@app.route('/api/love-interest-categories')
def api_love_interest_categories():

    cats = db.supabase.query('love_interest_categories', params={'order': 'name'}, select='slug,name')
    return jsonify(cats)

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

@app.route('/api/admin/gallery', methods=['GET'])
@jwt_required()
def api_get_all_gallery_images():
    return jsonify(db.get_all_gallery_images())

@app.route('/api/admin/gallery', methods=['POST'])
@jwt_required()
def api_create_gallery_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    character_id = request.form.get('character_id')
    alt_text = request.form.get('alt_text', '')

    if not character_id:
        return jsonify({'error': 'Character ID is required'}), 400

    try:
        filename = secure_filename(file.filename)
        unique_filename = f"{character_id}/{int(datetime.now().timestamp())}_{filename}"
        content_type = file.mimetype or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        bucket_name = 'gallery-images'
        
        file_body = file.read()
        public_url = db.supabase.upload_file(bucket_name, unique_filename, file_body, content_type)
        
        if not public_url:
            return jsonify({'error': 'Failed to upload image to storage'}), 500

        data = {
            'character_id': character_id,
            'image_url': public_url,
            'alt_text': alt_text
        }
        
        result = db.create_gallery_image(data)
        
        if result:
            return jsonify(result), 201
        else:
            db.supabase.delete_file(bucket_name, unique_filename)
            return jsonify({'error': 'Database insert failed'}), 500

    except Exception as e:
        print(f"Gallery upload error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/gallery/<int:image_id>', methods=['DELETE'])
@jwt_required()
def api_delete_gallery_image(image_id):
    success = db.delete_gallery_image(image_id)
    if success:
        return jsonify({'success': True}), 200
    return jsonify({'error': 'Failed to delete image'}), 500

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

@app.route('/api/admin/love-interests', methods=['GET'])
@jwt_required()
def api_get_all_love_interests():

    return jsonify(db.get_all_love_interests())

@app.route('/api/admin/love-interests/<int:interest_id>', methods=['GET'])
@jwt_required()
def api_get_love_interest(interest_id):
    interest = db.get_love_interest_by_id(interest_id)
    if not interest:
        return jsonify({'error': 'Love interest not found'}), 404
    return jsonify(interest)

@app.route('/api/admin/love-interests', methods=['POST'])
@jwt_required()
def api_create_love_interest():
    data = request.get_json()
    if not data or 'character_one_id' not in data or 'character_two_id' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    interest = db.create_love_interest(data)
    if interest:
        return jsonify(interest), 201
    return jsonify({'error': 'Failed to create love interest. The relationship may already exist or character IDs are invalid.'}), 500

@app.route('/api/admin/love-interests/<int:interest_id>', methods=['PUT'])
@jwt_required()
def api_update_love_interest(interest_id):
    data = request.get_json()
    updated = db.update_love_interest(interest_id, data)
    if updated:
        return jsonify(updated), 200
    return jsonify({'error': 'Failed to update love interest'}), 500

@app.route('/api/admin/love-interests/<int:interest_id>', methods=['DELETE'])
@jwt_required()
def api_delete_love_interest(interest_id):
    success = db.delete_love_interest(interest_id)
    if success:
        return jsonify({'success': True}), 200
    return jsonify({'error': 'Failed to delete love interest'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
