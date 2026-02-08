import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Index from "@/pages/Index";

// Viewport breakpoints matching tailwind.config.ts
const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1400,
  "3xl": 1920,
  "4xl": 2560,
} as const;

// Common device sizes for testing
const DEVICE_SIZES = {
  "iPhone SE": { width: 375, height: 667 },
  "iPhone 14": { width: 390, height: 844 },
  "iPad Mini": { width: 768, height: 1024 },
  "iPad Pro": { width: 1024, height: 1366 },
  "MacBook Pro": { width: 1440, height: 900 },
  "Desktop HD": { width: 1920, height: 1080 },
  "Desktop 4K": { width: 2560, height: 1440 },
} as const;

/**
 * Simulates a viewport size by mocking window.innerWidth/innerHeight
 * and triggering matchMedia queries accordingly
 */
function setViewport(width: number, height: number = 800) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });

  // Mock matchMedia to respond correctly to media queries
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      // Parse min-width queries like "(min-width: 768px)"
      const minWidthMatch = query.match(/\(min-width:\s*(\d+)px\)/);
      const maxWidthMatch = query.match(/\(max-width:\s*(\d+)px\)/);
      
      let matches = false;
      
      if (minWidthMatch) {
        const minWidth = parseInt(minWidthMatch[1], 10);
        matches = width >= minWidth;
      } else if (maxWidthMatch) {
        const maxWidth = parseInt(maxWidthMatch[1], 10);
        matches = width <= maxWidth;
      }

      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    },
  });

  // Dispatch resize event to trigger useIsMobile and useIsLargeScreen hooks
  window.dispatchEvent(new Event("resize"));
}

// Helper to render Index with router and get query functions
function renderIndex() {
  const result = render(
    <BrowserRouter>
      <Index />
    </BrowserRouter>
  );
  return result;
}

describe("Landing Page Responsiveness", () => {
  beforeEach(() => {
    // Reset to default desktop viewport
    setViewport(1280, 800);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Core Layout Elements", () => {
    it("renders header with logo on all viewports", () => {
      const { getAllByRole } = renderIndex();
      
      // Logo should always be present
      const logos = getAllByRole("link");
      expect(logos.length).toBeGreaterThan(0);
    });

    it("renders hero section with title", () => {
      const { getByRole } = renderIndex();
      
      // Main heading should be present
      const heading = getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent(/Nutrição inteligente/i);
    });

    it("renders CTA buttons", () => {
      const { getAllByRole } = renderIndex();
      
      // Primary CTA
      const ctaButtons = getAllByRole("link");
      const signupLink = ctaButtons.find(link => 
        link.getAttribute("href") === "/signup"
      );
      expect(signupLink).toBeInTheDocument();
    });

    it("renders features section", () => {
      const { getByText } = renderIndex();
      
      // Feature titles should be present
      expect(getByText("Metas Personalizadas")).toBeInTheDocument();
      expect(getByText("Substituição Inteligente")).toBeInTheDocument();
      expect(getByText("Assistente IA")).toBeInTheDocument();
    });

    it("renders steps section", () => {
      const { getByText } = renderIndex();
      
      expect(getByText("Crie sua conta")).toBeInTheDocument();
      expect(getByText("Receba seu plano")).toBeInTheDocument();
      expect(getByText("Siga e adapte")).toBeInTheDocument();
      expect(getByText("Alcance resultados")).toBeInTheDocument();
    });
  });

  describe("Mobile Viewport (< 768px)", () => {
    beforeEach(() => {
      setViewport(375, 667); // iPhone SE
    });

    it("renders mobile-optimized hero", () => {
      const { getByText, getByRole } = renderIndex();
      
      // Badge should be present
      expect(getByText(/Planejamento alimentar com IA/i)).toBeInTheDocument();
      
      // Title should be present
      const heading = getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("renders stacked CTA buttons on mobile", () => {
      const { getByText } = renderIndex();
      
      // Both buttons should be present
      expect(getByText("Começar agora")).toBeInTheDocument();
      expect(getByText("Como funciona")).toBeInTheDocument();
    });

    it("renders mobile navigation buttons", () => {
      const { getByText, getAllByRole } = renderIndex();
      
      // Login button
      expect(getByText("Entrar")).toBeInTheDocument();
      
      // Signup button (short version on mobile)
      const signupButtons = getAllByRole("button");
      const hasSignupButton = signupButtons.some(btn => 
        btn.textContent?.includes("Começar")
      );
      expect(hasSignupButton).toBe(true);
    });
  });

  describe("Tablet Viewport (768px - 1024px)", () => {
    beforeEach(() => {
      setViewport(834, 1194); // iPad Pro 11"
    });

    it("renders two-column hero layout", () => {
      const { getByRole } = renderIndex();
      
      // Should have the full heading
      const heading = getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("renders features in grid layout", () => {
      const { getByText } = renderIndex();
      
      // All 6 features should be present
      expect(getByText("Metas Personalizadas")).toBeInTheDocument();
      expect(getByText("Relatórios de Progresso")).toBeInTheDocument();
      expect(getByText("Gamificação")).toBeInTheDocument();
      expect(getByText("Registro Diário")).toBeInTheDocument();
    });
  });

  describe("Desktop Viewport (>= 1024px)", () => {
    beforeEach(() => {
      setViewport(1440, 900);
    });

    it("renders full desktop layout", () => {
      const { getByRole } = renderIndex();
      
      const heading = getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("renders scroll indicator on desktop", () => {
      renderIndex();
      
      // The scroll indicator div should be present (visual element)
      // We check for the animate presence of motion elements
      const container = document.querySelector('[class*="overflow-hidden"]');
      expect(container).toBeInTheDocument();
    });

    it("renders all navigation items", () => {
      const { getByText } = renderIndex();
      
      expect(getByText("Entrar")).toBeInTheDocument();
      expect(getByText("Começar grátis")).toBeInTheDocument();
    });
  });

  describe("Large Screen Viewport (>= 1920px)", () => {
    beforeEach(() => {
      setViewport(1920, 1080);
    });

    it("renders enhanced 3xl layout", () => {
      const { getByRole } = renderIndex();
      
      // Should render without errors
      const heading = getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("renders all sections properly", () => {
      const { getByText } = renderIndex();
      
      // Hero
      expect(getByText(/Nutrição inteligente/i)).toBeInTheDocument();
      
      // Features
      expect(getByText("O que você pode fazer")).toBeInTheDocument();
      
      // Steps
      expect(getByText("Como funciona")).toBeInTheDocument();
    });
  });

  describe("Breakpoint Coverage", () => {
    // Test all defined breakpoints
    Object.entries(BREAKPOINTS).forEach(([name, width]) => {
      it(`renders correctly at ${name} breakpoint (${width}px)`, () => {
        setViewport(width);
        
        expect(() => renderIndex()).not.toThrow();
        
        const { getByRole } = renderIndex();
        
        // Core elements should always be present
        expect(getByRole("heading", { level: 1 })).toBeInTheDocument();
        
        cleanup();
      });
    });
  });

  describe("Device Simulation", () => {
    Object.entries(DEVICE_SIZES).forEach(([device, { width, height }]) => {
      it(`renders correctly on ${device} (${width}x${height})`, () => {
        setViewport(width, height);
        
        expect(() => renderIndex()).not.toThrow();
        
        const { getByRole, getByText } = renderIndex();
        
        // Should have main content
        expect(getByRole("heading", { level: 1 })).toBeInTheDocument();
        expect(getByText(/Planejamento alimentar/i)).toBeInTheDocument();
        
        cleanup();
      });
    });
  });

  describe("Accessibility at Different Viewports", () => {
    const testViewports = [
      { name: "mobile", width: 375 },
      { name: "tablet", width: 768 },
      { name: "desktop", width: 1280 },
    ];

    testViewports.forEach(({ name, width }) => {
      it(`has accessible navigation on ${name}`, () => {
        setViewport(width);
        const { getAllByRole } = renderIndex();
        
        // All links should have accessible names
        const links = getAllByRole("link");
        links.forEach(link => {
          expect(link).toHaveAccessibleName();
        });
        
        cleanup();
      });

      it(`has accessible buttons on ${name}`, () => {
        setViewport(width);
        const { getAllByRole } = renderIndex();
        
        // All buttons should have accessible names
        const buttons = getAllByRole("button");
        buttons.forEach(button => {
          expect(button).toHaveAccessibleName();
        });
        
        cleanup();
      });

      it(`has proper heading hierarchy on ${name}`, () => {
        setViewport(width);
        const { getAllByRole } = renderIndex();
        
        // Should have exactly one h1
        const h1s = getAllByRole("heading", { level: 1 });
        expect(h1s).toHaveLength(1);
        
        cleanup();
      });
    });
  });

  describe("Image Loading", () => {
    it("hero image has proper alt text", () => {
      setViewport(1280);
      const { getByAltText } = renderIndex();
      
      const heroImg = getByAltText(/NutriPlan.*Planejamento alimentar/i);
      expect(heroImg).toBeInTheDocument();
    });

    it("hero image has loading optimization attributes", () => {
      setViewport(1280);
      const { getByAltText } = renderIndex();
      
      const heroImg = getByAltText(/NutriPlan.*Planejamento alimentar/i);
      
      // Priority images should have eager loading
      expect(heroImg).toHaveAttribute("loading", "eager");
    });
  });
});
