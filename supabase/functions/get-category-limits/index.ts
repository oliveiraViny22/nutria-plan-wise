// =====================================================
// GET CATEGORY LIMITS - Expõe limites centralizados
// =====================================================
// Permite que o frontend busque os limites de categoria
// diretamente do backend, garantindo sincronização.
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CATEGORY_LIMITS,
  SNACK_CATEGORY_LIMITS,
  SCALE_CATEGORY_LIMITS,
  DEFAULT_CATEGORY_LIMITS,
  DEFAULT_SCALE_LIMITS,
} from "../_shared/category-limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Versão para cache-busting (incrementar ao alterar limites)
    const version = "1.0.0";
    
    const payload = {
      version,
      timestamp: new Date().toISOString(),
      limits: {
        category: CATEGORY_LIMITS,
        snack: SNACK_CATEGORY_LIMITS,
        scale: SCALE_CATEGORY_LIMITS,
      },
      defaults: {
        category: DEFAULT_CATEGORY_LIMITS,
        scale: DEFAULT_SCALE_LIMITS,
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Cache por 1 hora no CDN e no browser
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error in get-category-limits:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
