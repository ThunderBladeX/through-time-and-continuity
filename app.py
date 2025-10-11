from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import os
import markdown as md
from datetime import datetime
import json
from database import db
import mimetypes

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SESSION_SECRET', 'dev-secret-key')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = None

# Simple user class for admin authentication
class User(UserMixin):
    def __init__(self, id):
        self.id = id

@login_manager.user_loader
def load_user(user_id):
    return User(user_id)

# Era display names mapping - Loaded from the database
ERA_NAMES = {}
try:
    with app.app_context():
        ERA_NAMES = db.get_all_eras()
except Exception as e:
    print(f"Initial ERA_NAMES load from database failed: {e}")

if not ERA_NAMES:
    print("Warning: Could not load ERA_NAMES from database. Using fallback.")
    ERA_NAMES = {
        'pre-52': 'Pre-New 52',
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

# Routes
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

# API Routes
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
            'related_character_name': related.get('full_name', ''),
            'related_character_image': related.get('profile_image', '/static/images/default-avatar.jpg')
        })
    return jsonify(formatted)

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
            'character_name': first_char.get('full_name', ''),
            'character_image': first_char.get('profile_image', '/static/images/default-avatar.jpg'),
            'characters': [ec['characters']['full_name'] for ec in event_chars if 'characters' in ec]
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

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    username = data.get('username')
    password = data.get('password')
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
    if username == admin_username and password == admin_password:
        user = User(1)
        login_user(user)
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/api/admin/pending-edits', methods=['GET'])
@login_required
def api_get_pending_edits():
    return jsonify(db.get_pending_edits())

@app.route('/api/admin/pending-edits/<int:edit_id>', methods=['PATCH'])
@login_required
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
@login_required
def api_get_all_relationships():
    return jsonify(db.get_all_relationships())

@app.route('/api/admin/gallery', methods=['GET'])
@login_required
def api_get_all_gallery_images():
    return jsonify(db.get_all_gallery_images())

@app.route('/api/admin/characters', methods=['POST'])
@login_required
def api_create_character():
    data = request.form.to_dict()
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
        return jsonify(character), 201
    else:
        print("db.create_character returned None. Character creation failed in database.py.")
        return jsonify({'error': 'Failed to create character in database'}), 500

@app.route('/api/admin/characters/<int:character_id>', methods=['POST'])
@login_required
def api_update_character(character_id):
    data = request.form.to_dict()
    data = clean_form_data(data)
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
    return (jsonify(character), 200) if character else (jsonify({'error': 'Failed to update character. Check for empty required fields.'}), 500)

@app.route('/api/admin/characters/<int:character_id>', methods=['DELETE'])
@login_required
def api_delete_character(character_id):
    db.delete_character(character_id)
    return jsonify({'success': True}), 200

@app.route('/api/admin/events', methods=['POST'])
@login_required
def api_create_event():
    data = request.form.to_dict()
    character_ids_str = data.pop('character_ids', '')
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

@app.route('/api/admin/events/<int:event_id>', methods=['DELETE'])
@login_required
def api_delete_event(event_id):
    db.delete_event(event_id)
    return jsonify({'success': True}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
