"""
Script to set up the Supabase database schema.
Run this once to create all the necessary tables.
"""

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')

if not supabase_url or not supabase_key:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

# Read schema file
with open('schema.sql', 'r') as f:
    schema = f.read()

print("Setting up database schema...")
print("\nNOTE: You need to run this SQL in the Supabase SQL Editor:")
print("1. Go to your Supabase project dashboard")
print("2. Click on 'SQL Editor' in the left sidebar")
print("3. Click 'New Query'")
print("4. Copy and paste the SQL from schema.sql")
print("5. Click 'Run' to execute")
print("\nAlso, create these storage buckets in Supabase:")
print("1. Go to 'Storage' in the left sidebar")
print("2. Create these buckets (make them public):")
print("   - character-images")
print("   - event-images")
print("   - gallery-images")
print("\nSchema is ready in schema.sql file!")
