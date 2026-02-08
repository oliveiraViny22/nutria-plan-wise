# Análise do Sistema de Planos e Assinaturas - NutriPlan

**Data da Análise:** 2026-02-08  
**Versão do Sistema:** v2

---

## 1. Resumo Executivo

O sistema de planos e assinaturas do NutriPlan está **adequadamente estruturado** para testes de planos gratuitos e pagos. A arquitetura segue boas práticas de separação de responsabilidades, com controle de limites tanto no frontend quanto no backend.

### Status Geral: ✅ ADEQUADO PARA TESTES

---

## 2. Arquitetura de Planos

### 2.1 Planos Configurados no Banco de Dados

| Plano | Tipo | Preço | Dietas | Substituições | Ajustes | Chat/dia | Opções Refeição |
|-------|------|-------|--------|---------------|---------|----------|-----------------|
| **Gratuito** | `gratuito` | R$ 0,00 | 1 | 3 | 1 | 0 (educacional) | 1 |
| **Premium Aluno** | `plano_pessoal_pago` | R$ 4,90 | 0 | 0 | 0 | 5 | 3 |
| **Plano Pessoal** | `plano_pessoal_pago` | R$ 29,90 | 1 | 999 | 999 | 999 | 3 |
| **Profissional** | `profissional` | - | - | - | - | - | - |

### 2.2 Usuários de Teste Existentes

| Email | Plano | Status | Uso |
|-------|-------|--------|-----|
| `onboarding@onboarding.com.br` | Gratuito | Trial | 0 dietas, 0 subs, 0 ajustes |
| `admin@nutriaplan.com` | Profissional | Active | 36 dietas, 25 subs, 101 ajustes |

---

## 3. Análise Técnica

### 3.1 Backend - Edge Functions ✅

#### check-subscription
- ✅ Valida autenticação via JWT
- ✅ Busca roles de usuário (`user_roles`)
- ✅ Carrega plano ativo com JOIN em `plans`
- ✅ Retorna dados de uso (`user_usage`)
- ✅ Reset automático de chat diário
- ✅ Diferencia admin/profissional

#### validate-usage
- ✅ Valida feature (diet/substitution/adjustment/chat)
- ✅ Usa RPC `can_use_feature` para verificação
- ✅ Usa RPC `increment_usage` para incremento
- ✅ Retorna mensagens de limite específicas
- ✅ Retorna `upgradeRequired: true` quando limite atingido

#### create-checkout
- ✅ Busca plano por ID ou tipo
- ✅ Valida restrições do Premium (vinculado a profissional)
- ✅ Previne re-contratação do mesmo plano
- ✅ Cria sessão Stripe com metadados corretos
- ⚠️ **PENDENTE**: `stripe_price_monthly` é `null` para alguns planos

### 3.2 Frontend - Hooks ✅

#### useSubscription
- ✅ Refresh a cada 5 minutos
- ✅ Retry automático em 401
- ✅ Métodos: `createCheckout`, `openCustomerPortal`, `validateUsage`

#### useUsageLimits
- ✅ Sincronização realtime via `postgres_changes`
- ✅ Suporte a limites ilimitados (999999)
- ✅ Helpers: `canUse()`, `isLimitReached()`

#### useCachedUserData
- ✅ Cache de 1 minuto
- ✅ Deduplicação de requests concorrentes
- ✅ Deriva `isAdmin`, `isProfessional`, `isStudent`

### 3.3 Banco de Dados ✅

#### Tabelas Principais
- `plans` - Definição dos planos comerciais
- `subscriptions` - Assinaturas ativas dos usuários
- `user_usage` - Contadores de uso por usuário
- `user_roles` - Roles de acesso (admin, professional, user)

#### RPCs de Segurança
- `can_use_feature(_user_id, _feature)` - Verifica permissão
- `increment_usage(_user_id, _feature)` - Incrementa contador
- `get_user_plan(_user_id)` - Retorna dados do plano

---

## 4. Fluxos de Teste Recomendados

### 4.1 Teste do Plano Gratuito

```
1. Criar nova conta (email + senha)
2. Completar onboarding
3. Gerar 1 dieta (limite: 1)
4. Tentar gerar 2ª dieta → Deve bloquear
5. Fazer 3 substituições (limite: 3)
6. Tentar 4ª substituição → Deve bloquear
7. Fazer 1 ajuste automático (limite: 1)
8. Tentar 2º ajuste → Deve bloquear
9. Verificar chat educacional (sem limite diário)
10. Verificar teaser de features premium bloqueadas
```

### 4.2 Teste do Plano Pago (Plano Pessoal)

```
1. Usar conta com Plano Pessoal ativo
2. Verificar limites ilimitados (999)
3. Gerar múltiplas dietas
4. Fazer substituições sem bloqueio
5. Fazer ajustes sem bloqueio
6. Usar chat (limite: 999/dia)
7. Verificar acesso a funcionalidades premium
8. Verificar 3 opções por refeição
```

### 4.3 Teste de Transição de Planos

```
1. Conta gratuita → Checkout → Plano Pessoal
2. Verificar sincronização de `subscriptions`
3. Verificar `user_usage` mantido
4. Verificar limites atualizados
5. Testar Customer Portal (gerenciar assinatura)
```

---

## 5. Problemas Identificados

### 5.1 Críticos ❌
Nenhum problema crítico identificado.

### 5.2 Importantes ⚠️

| # | Problema | Impacto | Solução |
|---|----------|---------|---------|
| 1 | `stripe_price_monthly` é NULL para planos ativos | Checkout falha para esses planos | Configurar IDs de preço no Stripe e atualizar tabela `plans` |
| 2 | Extension in Public (linter) | Segurança | Mover extensões para schema separado |
| 3 | Leaked Password Protection Disabled | Segurança | Habilitar verificação de senhas vazadas |

### 5.3 Menores ℹ️

| # | Observação | Recomendação |
|---|------------|--------------|
| 1 | Premium Aluno tem diet_limit=0 | Verificar se é intencional (aluno não gera dietas) |
| 2 | Cache de 5 min no refresh | Pode causar delay em updates de plano |

---

## 6. Matriz de Funcionalidades por Plano

| Funcionalidade | Gratuito | Premium Aluno | Plano Pessoal |
|----------------|----------|---------------|---------------|
| Gerar Dietas | 1/mês | 0 | 1/mês |
| Substituições | 3 | 0 | ∞ |
| Ajustes IA | 1 | 0 | ∞ |
| Chat IA | Educacional | 5/dia | ∞ |
| Opções/Refeição | 1 | 3 | 3 |
| Registro Diário | ❌ | ✅ | ✅ |
| Progresso | ❌ | ✅ | ✅ |
| Gamificação | 👁️ Teaser | ✅ | ✅ |
| Suplementação | 👁️ Teaser | ✅ | ✅ |

---

## 7. Checklist de Testes

### Autenticação
- [ ] Signup com email
- [ ] Login com email
- [ ] Logout
- [ ] Recuperação de senha
- [ ] Sessão expira corretamente

### Plano Gratuito
- [ ] Limite de dietas funciona
- [ ] Limite de substituições funciona
- [ ] Limite de ajustes funciona
- [ ] Chat educacional acessível
- [ ] Teasers premium visíveis
- [ ] Upgrade flow funciona

### Plano Pago
- [ ] Checkout Stripe funciona
- [ ] Webhook processa pagamento
- [ ] Limites ilimitados aplicados
- [ ] Todas features premium acessíveis
- [ ] Customer Portal funciona

### Sincronização
- [ ] Realtime updates de usage
- [ ] Cache invalidation funciona
- [ ] Refresh de subscription funciona

---

## 8. Recomendações

### Antes de Testes de Produção

1. **Configurar Stripe Price IDs**
   ```sql
   UPDATE plans SET stripe_price_monthly = 'price_xxx' WHERE name = 'Plano Pessoal';
   ```

2. **Habilitar Proteção de Senhas Vazadas**
   - Cloud View → Users → Auth Settings → Password HIBP Check

3. **Criar Usuários de Teste**
   ```sql
   -- Usuário gratuito limpo
   -- Usuário pago com uso parcial
   -- Usuário pago com limites esgotados
   ```

### Melhorias Sugeridas

1. Adicionar logs de auditoria para mudanças de plano
2. Implementar notificações de limite próximo (80%)
3. Criar endpoint de health check para monitoramento
4. Adicionar métricas de conversão (gratuito → pago)

---

## 9. Conclusão

O sistema está **pronto para testes** com as seguintes ressalvas:

1. ✅ Arquitetura sólida com separação frontend/backend
2. ✅ Controle de limites implementado em ambas as camadas
3. ✅ Sincronização realtime funcional
4. ⚠️ Configurar Stripe Price IDs antes de testar checkout
5. ⚠️ Habilitar proteção de senhas vazadas

**Próximos Passos:**
1. Configurar `stripe_price_monthly` na tabela `plans`
2. Criar usuários de teste para cada cenário
3. Executar checklist de testes
4. Documentar resultados
