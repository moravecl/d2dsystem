/*
  # Fix all infinite recursion in profiles and related RLS policies

  1. Changes
    - Drop all admin policies on `profiles` that use subqueries to profiles (causing infinite recursion)
    - Recreate them using the existing `public.is_admin()` SECURITY DEFINER function
    - Drop and recreate admin policies on `product_images` to use `is_admin()` instead of subqueries
    - Drop and recreate admin policy on `projects` to use `is_admin()` instead of subquery

  2. Security
    - `is_admin()` uses SECURITY DEFINER so it bypasses RLS and avoids recursion
    - All policies remain restricted to authenticated users
    - All ownership/admin checks preserved

  3. Important Notes
    - This fixes the "infinite recursion detected in policy for relation profiles" error
    - The root cause was policies on profiles that queried profiles in their USING/WITH CHECK clauses
*/

-- Drop all problematic admin policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile role" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Recreate a single admin SELECT policy using is_admin()
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- Recreate admin UPDATE policy using is_admin()
CREATE POLICY "Admins can update any profile role"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- Fix product_images policies to use is_admin()
DROP POLICY IF EXISTS "Admins can insert product images" ON product_images;
DROP POLICY IF EXISTS "Admins can update product images" ON product_images;
DROP POLICY IF EXISTS "Admins can delete product images" ON product_images;

CREATE POLICY "Admins can insert product images"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update product images"
  ON product_images
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete product images"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Fix projects admin policy to use is_admin()
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;

CREATE POLICY "Admins can view all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
