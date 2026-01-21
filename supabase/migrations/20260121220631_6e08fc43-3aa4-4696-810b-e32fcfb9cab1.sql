-- Add INSERT policy for admins on foods table
CREATE POLICY "Admins can insert foods" 
ON public.foods 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policy for admins on foods table
CREATE POLICY "Admins can update foods" 
ON public.foods 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for admins on foods table
CREATE POLICY "Admins can delete foods" 
ON public.foods 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));