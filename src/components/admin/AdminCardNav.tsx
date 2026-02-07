/**
 * Admin Card Navigation Component
 * 
 * Visual card-based navigation for admin panel with:
 * - Category cards with icons and descriptions
 * - Expandable sub-items as mini-cards
 * - Glassmorphism design following NutriPlan premium aesthetic
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

interface TabCategory {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  tabs: TabItem[];
}

interface AdminCardNavProps {
  categories: TabCategory[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function AdminCardNav({ categories, activeTab, onTabChange }: AdminCardNavProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(() => {
    // Find category containing active tab
    const category = categories.find(cat => cat.tabs.some(tab => tab.id === activeTab));
    return category?.id || null;
  });

  const handleCategoryClick = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
    }
  };

  const handleTabClick = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onTabChange(tabId);
  };

  const getActiveCategory = () => {
    return categories.find(cat => cat.tabs.some(tab => tab.id === activeTab));
  };

  return (
    <div className="space-y-3">
      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {categories.map((category) => {
          const isExpanded = expandedCategory === category.id;
          const isActive = getActiveCategory()?.id === category.id;
          const CategoryIcon = category.icon;

          return (
            <motion.div
              key={category.id}
              layout
              className={cn(
                "relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer",
                isExpanded && "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-5"
              )}
            >
              {/* Category Card */}
              <div
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  "glass-card-interactive p-4 rounded-xl border",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  isActive && "ring-2 ring-primary/50 border-primary/30",
                  isExpanded && "bg-card/95"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div 
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
                        "transition-colors duration-200"
                      )}
                      style={{ 
                        backgroundColor: `hsl(${category.color} / 0.15)`,
                        color: `hsl(${category.color})`
                      }}
                    >
                      <CategoryIcon className="h-5 w-5" />
                    </div>

                    {/* Text */}
                    <div className="min-w-0">
                      <h3 className={cn(
                        "font-semibold text-foreground truncate",
                        isActive && "text-primary"
                      )}>
                        {category.label}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  {/* Expand Indicator */}
                  <ChevronRight 
                    className={cn(
                      "h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200",
                      isExpanded && "rotate-90"
                    )} 
                  />
                </div>

                {/* Sub-items Preview (collapsed) */}
                {!isExpanded && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {category.tabs.map((tab) => {
                      const TabIcon = tab.icon;
                      const isTabActive = tab.id === activeTab;
                      
                      return (
                        <div
                          key={tab.id}
                          onClick={(e) => handleTabClick(tab.id, e)}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                            "transition-all duration-150 hover:scale-105",
                            isTabActive 
                              ? "bg-primary text-primary-foreground font-medium" 
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <TabIcon className="h-3 w-3" />
                          <span>{tab.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expanded Sub-cards */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4 pt-4 border-t border-border/50"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {category.tabs.map((tab) => {
                          const TabIcon = tab.icon;
                          const isTabActive = tab.id === activeTab;

                          return (
                            <motion.button
                              key={tab.id}
                              onClick={(e) => handleTabClick(tab.id, e)}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15 }}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg text-left w-full",
                                "transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]",
                                isTabActive 
                                  ? "bg-primary text-primary-foreground shadow-md" 
                                  : "bg-muted/30 hover:bg-muted/60 text-foreground"
                              )}
                            >
                              <div className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-md shrink-0",
                                isTabActive 
                                  ? "bg-primary-foreground/20" 
                                  : "bg-muted"
                              )}>
                                <TabIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-sm truncate block">
                                  {tab.label}
                                </span>
                                {tab.description && (
                                  <span className={cn(
                                    "text-xs truncate block",
                                    isTabActive 
                                      ? "text-primary-foreground/70" 
                                      : "text-muted-foreground"
                                  )}>
                                    {tab.description}
                                  </span>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Active Tab Breadcrumb */}
      {activeTab && (
        <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          <span>Visualizando:</span>
          <span className="font-medium text-foreground">
            {getActiveCategory()?.label}
          </span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-primary">
            {categories
              .flatMap(cat => cat.tabs)
              .find(tab => tab.id === activeTab)?.label}
          </span>
        </div>
      )}
    </div>
  );
}
