/**
 * Admin Card Navigation Component
 * 
 * Visual card-based navigation for admin panel with:
 * - Category cards with icons and descriptions
 * - Expandable sub-items as mini-cards
 * - Glassmorphism design following NutriPlan premium aesthetic
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, LucideIcon } from 'lucide-react';
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
  onExpandedChange?: (isExpanded: boolean, categoryId: string | null) => void;
}

export function AdminCardNav({ categories, activeTab, onTabChange, onExpandedChange }: AdminCardNavProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(() => {
    const category = categories.find(cat => cat.tabs.some(tab => tab.id === activeTab));
    return category?.id || null;
  });

  // Notify parent of expansion state changes
  useEffect(() => {
    onExpandedChange?.(expandedCategory !== null, expandedCategory);
  }, [expandedCategory, onExpandedChange]);

  const handleCategoryClick = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
    }
  };

  const handleTabClick = (tabId: string, categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Ensure the category stays expanded when selecting a tab
    setExpandedCategory(categoryId);
    onTabChange(tabId);
  };

  const getActiveCategory = () => {
    return categories.find(cat => cat.tabs.some(tab => tab.id === activeTab));
  };

  // Check if the active tab's category is currently expanded
  const isContentVisible = expandedCategory !== null && 
    categories.find(cat => cat.id === expandedCategory)?.tabs.some(tab => tab.id === activeTab);

  return (
    <div className="space-y-4">
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
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className={cn(
                "relative overflow-hidden rounded-xl cursor-pointer",
                isExpanded && "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-5"
              )}
            >
              {/* Category Card */}
              <div
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  "glass-card-interactive p-4 rounded-xl border transition-all duration-200",
                  "hover:shadow-lg",
                  isActive && !isExpanded && "ring-2 ring-primary/50 border-primary/30",
                  isExpanded && "bg-card border-primary/20 shadow-lg"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div 
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
                        "transition-all duration-200"
                      )}
                      style={{ 
                        backgroundColor: `hsl(${category.color} / ${isExpanded ? 0.2 : 0.12})`,
                        color: `hsl(${category.color})`
                      }}
                    >
                      <CategoryIcon className="h-5 w-5" />
                    </div>

                    {/* Text */}
                    <div className="min-w-0">
                      <h3 className={cn(
                        "font-semibold truncate transition-colors",
                        isExpanded ? "text-primary" : "text-foreground"
                      )}>
                        {category.label}
                      </h3>
                      {!isExpanded && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expand Indicator */}
                  <ChevronDown 
                    className={cn(
                      "h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200",
                      isExpanded && "rotate-180 text-primary"
                    )} 
                  />
                </div>

                {/* Collapsed: Tab Pills */}
                {!isExpanded && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {category.tabs.map((tab) => {
                      const TabIcon = tab.icon;
                      const isTabActive = tab.id === activeTab;
                      
                      return (
                        <div
                          key={tab.id}
                          onClick={(e) => handleTabClick(tab.id, category.id, e)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                            "transition-all duration-150 hover:scale-105 active:scale-95",
                            isTabActive 
                              ? "bg-primary text-primary-foreground font-medium shadow-sm" 
                              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <TabIcon className="h-3.5 w-3.5" />
                          <span>{tab.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expanded: Sub-cards Grid */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4 pt-4 border-t border-border/50"
                    >
                      <div className="flex flex-wrap justify-center gap-3">
                        {category.tabs.map((tab, index) => {
                          const TabIcon = tab.icon;
                          const isTabActive = tab.id === activeTab;

                          return (
                            <motion.button
                              key={tab.id}
                              onClick={(e) => handleTabClick(tab.id, category.id, e)}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15, delay: index * 0.03 }}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-left min-w-[180px] max-w-[240px]",
                                "transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]",
                                isTabActive 
                                  ? "bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30" 
                                  : "bg-muted/40 hover:bg-muted/70 text-foreground border border-border/50"
                              )}
                            >
                              <div className={cn(
                                "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                                isTabActive 
                                  ? "bg-primary-foreground/20" 
                                  : "bg-background"
                              )}>
                                <TabIcon className="h-4.5 w-4.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-sm block">
                                  {tab.label}
                                </span>
                                {tab.description && (
                                  <span className={cn(
                                    "text-xs block mt-0.5",
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

      {/* Content visibility indicator - used by parent */}
      <input type="hidden" data-content-visible={isContentVisible} />
    </div>
  );
}

// Export helper to check if content should be shown
export function useAdminNavState() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const handleExpandedChange = (expanded: boolean, categoryId: string | null) => {
    setIsExpanded(expanded);
    setExpandedCategoryId(categoryId);
  };

  return { isExpanded, expandedCategoryId, handleExpandedChange };
}
