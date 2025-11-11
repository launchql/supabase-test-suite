-- Seed data for rls_test schema
-- This file can be used to populate the database with test data

-- Insert test users
INSERT INTO auth.users (id, email) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'alice@example.com'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob@example.com'),
  ('550e8400-e29b-41d4-a716-446655440003', 'charlie@example.com'),
  ('550e8400-e29b-41d4-a716-446655440004', 'diana@example.com');

-- Insert test products
INSERT INTO rls_test.pets (id, name, breed, user_id) VALUES 
  ('660e8400-e29b-41d4-a716-446655440001', 'Fido', 'Labrador', '550e8400-e29b-41d4-a716-446655440001'),
  ('660e8400-e29b-41d4-a716-446655440002', 'Buddy', 'Golden Retriever', '550e8400-e29b-41d4-a716-446655440002'),
  ('660e8400-e29b-41d4-a716-446655440003', 'Rex', 'German Shepherd', '550e8400-e29b-41d4-a716-446655440003');
