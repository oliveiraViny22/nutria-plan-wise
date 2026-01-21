-- =====================================================
-- CORREÇÃO DE SEGURANÇA - PARTE 2
-- Adicionar política DELETE para chat_messages
-- =====================================================

-- Primeiro verificar se a tabela chat_messages existe
-- Se existir, adicionar política DELETE
DO $$
BEGIN
  -- Verificar se a tabela chat_messages existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
    -- Remover política se já existir
    DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
    
    -- Criar política DELETE
    EXECUTE 'CREATE POLICY "Users can delete their own chat messages" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;