-- Enable realtime for professional_students table only (system_settings already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.professional_students;