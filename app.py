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

# Era display names mapping
ERA_NAMES = {
    'pre-52': 'Pre-New 52',
    'new-52': 'New 52',
    'rebirth': 'Rebirth',
    'infinite-frontier': 'Infinite Frontier',
    'elseworlds': 'Elseworlds',
    'post-crisis': 'Post-Crisis',
    'future-state': 'Future State'
}

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
    # Add era display names
    for event in events:
        event['era_display'] = ERA_NAMES.get(event.get('era', ''), event.get('era', ''))
    return jsonify(events)

@app.route('/api/characters/<int:character_id>/relationships')
def api_character_relationships(character_id):
    relationships = db.get_character_relationships(character_id)
    # Format relationships for frontend
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
    # Format for frontend
    formatted = [{'url': img['image_url'], 'alt': img.get('alt_text', '')} for img in images]
    return jsonify(formatted)

@app.route('/api/events')
def api_events():
    limit = int(request.args.get('limit', 6))
    events = db.get_recent_events(limit)
    
    # Format for frontend
    formatted = []
    for event in events:
        # Get first character for display
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
    
    # Add era display name
    event['era_display'] = ERA_NAMES.get(event.get('era', ''), event.get('era', ''))
    
    # Convert markdown to HTML if present
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
    
    # Simple authentication - will be enhanced with database
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

@app.route('/api/admin/characters', methods=['POST'])
@login_required
def api_create_character():
    data = request.form.to_dict()
    
    # 1. Handle the file upload
    if 'profile_image' in request.files:
        file = request.files['profile_image']
        
        # Check if a file was actually uploaded
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            # Create a unique filename to avoid overwrites
            unique_filename = f"profile_{int(datetime.now().timestamp())}_{filename}"

            content_type = file.mimetype or mimetypes.guess_type(filename)[0]
            bucket_name = 'character-images' 
            
            # Read file content
            file_body = file.read()
            
            # Upload to Supabase Storage
            public_url = db.supabase.upload_file(bucket_name, unique_filename, file_body, content_type)
            if public_url:
                data['profile_image'] = public_url
            else:
                return jsonify({'error': 'Failed to upload image'}), 500

    # 2. Save the character data (with the new image URL) to the database
    character = db.create_character(data)
    if character:
        return jsonify(character), 201
    else:
        return jsonify({'error': 'Failed to create character'}), 500

@app.route('/api/admin/events', methods=['POST'])
@login_required
def api_create_event():
    data = request.get_json()
    event = db.create_event(data)
    return jsonify(event)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
