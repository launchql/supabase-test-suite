-- Seed data for rls_test schema
-- This file can be used to populate the database with test data

-- Insert test users
INSERT INTO rls_test.user_profiles (id, email, name) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'alice@example.com', 'Alice Johnson'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob@example.com', 'Bob Smith'),
  ('550e8400-e29b-41d4-a716-446655440003', 'charlie@example.com', 'Charlie Brown'),
  ('550e8400-e29b-41d4-a716-446655440004', 'diana@example.com', 'Diana Prince');

-- Insert test products
INSERT INTO rls_test.products (id, name, description, price, owner_id) VALUES 
  ('660e8400-e29b-41d4-a716-446655440001', 'Laptop Pro', 'High-performance laptop for developers', 1299.99, '550e8400-e29b-41d4-a716-446655440001'),
  ('660e8400-e29b-41d4-a716-446655440002', 'Wireless Mouse', 'Ergonomic wireless mouse', 49.99, '550e8400-e29b-41d4-a716-446655440001'),
  ('660e8400-e29b-41d4-a716-446655440003', 'Mechanical Keyboard', 'RGB mechanical keyboard', 149.99, '550e8400-e29b-41d4-a716-446655440002'),
  ('660e8400-e29b-41d4-a716-446655440004', 'Monitor 4K', '27-inch 4K monitor', 399.99, '550e8400-e29b-41d4-a716-446655440002'),
  ('660e8400-e29b-41d4-a716-446655440005', 'Webcam HD', '1080p webcam for video calls', 89.99, '550e8400-e29b-41d4-a716-446655440003'),
  ('660e8400-e29b-41d4-a716-446655440006', 'Headphones', 'Noise-cancelling headphones', 199.99, '550e8400-e29b-41d4-a716-446655440003'),
  ('660e8400-e29b-41d4-a716-446655440007', 'Standing Desk', 'Adjustable height standing desk', 599.99, '550e8400-e29b-41d4-a716-446655440004'),
  ('660e8400-e29b-41d4-a716-446655440008', 'Desk Lamp', 'LED desk lamp with USB charging', 79.99, '550e8400-e29b-41d4-a716-446655440004');

-- Verify the data
SELECT 
  u.name as user_name,
  u.email,
  COUNT(p.id) as product_count,
  COALESCE(SUM(p.price), 0) as total_value
FROM rls_test.user_profiles u
LEFT JOIN rls_test.products p ON u.id = p.owner_id
GROUP BY u.id, u.name, u.email
ORDER BY u.name;
