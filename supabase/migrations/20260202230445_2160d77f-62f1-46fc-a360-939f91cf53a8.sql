-- Add INSERT and UPDATE policies for admins on system_settings
CREATE POLICY "Admins can insert system_settings"
ON public.system_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update system_settings"
ON public.system_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));