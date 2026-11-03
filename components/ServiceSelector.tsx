"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Filter } from "lucide-react";
import { SERVICE_DEFINITIONS, getCategories } from "@/lib/services";
import type { ServiceType } from "@/lib/types";
import { ServiceIcon } from "./ServiceIcon";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface ServiceSelectorProps {
  onSelect: (serviceType: ServiceType) => void;
  selected?: ServiceType;
}

// Helper function to get color classes based on category
function getColorClass(category: string, isSelected: boolean): string {
  const colorMap: Record<string, { bg: string; bgLight: string; hover: string }> = {
    "Servers": { bg: "bg-blue-500", bgLight: "bg-blue-50", hover: "hover:bg-blue-100" },
    "Database": { bg: "bg-purple-500", bgLight: "bg-purple-50", hover: "hover:bg-purple-100" },
    "Message Queue": { bg: "bg-pink-500", bgLight: "bg-pink-50", hover: "hover:bg-pink-100" },
    "Storage": { bg: "bg-cyan-500", bgLight: "bg-cyan-50", hover: "hover:bg-cyan-100" },
    "CI/CD": { bg: "bg-indigo-500", bgLight: "bg-indigo-50", hover: "hover:bg-indigo-100" },
    "Container": { bg: "bg-blue-600", bgLight: "bg-blue-50", hover: "hover:bg-blue-100" },
    "Monitoring": { bg: "bg-green-500", bgLight: "bg-green-50", hover: "hover:bg-green-100" },
    "Caching": { bg: "bg-red-500", bgLight: "bg-red-50", hover: "hover:bg-red-100" },
    "Proxy": { bg: "bg-orange-500", bgLight: "bg-orange-50", hover: "hover:bg-orange-100" },
    "Version Control": { bg: "bg-gray-700", bgLight: "bg-gray-50", hover: "hover:bg-gray-100" },
    "Cloud": { bg: "bg-sky-500", bgLight: "bg-sky-50", hover: "hover:bg-sky-100" },
    "Config Management": { bg: "bg-violet-500", bgLight: "bg-violet-50", hover: "hover:bg-violet-100" },
    "Communication": { bg: "bg-teal-500", bgLight: "bg-teal-50", hover: "hover:bg-teal-100" },
    "Authentication": { bg: "bg-amber-500", bgLight: "bg-amber-50", hover: "hover:bg-amber-100" },
    "Other": { bg: "bg-gray-500", bgLight: "bg-gray-50", hover: "hover:bg-gray-100" },
  };

  const colors = colorMap[category] || colorMap["Other"];

  if (isSelected) {
    return `${colors.bg} text-white shadow-lg`;
  }
  return `${colors.bgLight} ${colors.hover}`;
}

export function ServiceSelector({ onSelect, selected }: ServiceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...getCategories()];

  const filteredServices = useMemo(() => {
    let services = SERVICE_DEFINITIONS;

    // Filter by category
    if (selectedCategory !== "All") {
      services = services.filter((s) => s.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      services = services.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.type.toLowerCase().includes(query) ||
          s.category.toLowerCase().includes(query)
      );
    }

    return services;
  }, [searchQuery, selectedCategory]);

  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = { All: SERVICE_DEFINITIONS.length };
    SERVICE_DEFINITIONS.forEach((service) => {
      counts[service.category] = (counts[service.category] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              selectedCategory === category
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {category}
            <span className="ml-2 text-xs opacity-75">({serviceCounts[category] || 0})</span>
          </button>
        ))}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{filteredServices.length}</span> services
        </p>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
          >
            Clear search
          </button>
        )}
      </div>

      {/* Services Grid */}
      <AnimatePresence mode="wait">
        {filteredServices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          >
            {filteredServices.map((service, index) => {
              const isSelected = selected === service.type;
              const colorClass = getColorClass(service.category, isSelected);
              return (
                <motion.button
                  key={service.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => onSelect(service.type)}
                  className={`p-3 rounded-lg border-2 transition-all text-left group hover:shadow-md ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${colorClass}`}
                    >
                      <ServiceIcon
                        type={service.type}
                        className={`w-4 h-4 ${isSelected ? "text-white" : "text-gray-700"}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-semibold truncate leading-tight ${
                          isSelected ? "text-blue-900" : "text-gray-900"
                        }`}
                      >
                        {service.label}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{service.category}</div>
                      {isSelected && (
                        <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-600 text-white text-[9px] rounded-full mt-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-2 h-2"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Selected
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
