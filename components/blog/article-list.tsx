"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Search, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { getArticlesForInfiniteScroll, getArticleSuggestions } from "@/app/actions/blog";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  metaDescription: string | null;
  category: string | null;
  tags: string[];
  publishedAt: Date | null;
  createdAt: Date | null;
}

interface ArticleListProps {
  initialArticles: Article[];
  initialTotal: number;
  categories: string[];
  currentCategory?: string;
  currentSearch?: string;
}

export function ArticleList({
  initialArticles,
  initialTotal,
  categories,
  currentCategory,
  currentSearch,
}: ArticleListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch || "");
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialArticles.length < initialTotal);
  const [offset, setOffset] = useState(initialArticles.length);
  const observerTarget = useRef<HTMLDivElement>(null);
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string; slug: string; category: string | null; excerpt: string | null }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset articles when filters change
  useEffect(() => {
    // Deduplicate initial articles by ID
    const uniqueArticles = initialArticles.filter(
      (article, index, self) => index === self.findIndex((a) => a.id === article.id)
    );
    setArticles(uniqueArticles);
    setOffset(uniqueArticles.length);
    setHasMore(uniqueArticles.length < initialTotal);
  }, [currentCategory, currentSearch, initialArticles, initialTotal]);

  // Fetch suggestions with debouncing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (search.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await getArticleSuggestions(search, 5);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") {
        handleSearch(e as any);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          router.push(`/article/${suggestions[selectedIndex].slug}`);
          setShowSuggestions(false);
        } else {
          handleSearch(e as any);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const loadMoreArticles = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const result = await getArticlesForInfiniteScroll({
        offset,
        limit: 12,
        category: currentCategory,
        search: currentSearch,
      });

      // Deduplicate articles by ID to prevent duplicate keys
      setArticles((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newArticles = result.articles.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newArticles];
      });
      setOffset((prev) => prev + result.articles.length);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading more articles:", error);
    } finally {
      setLoading(false);
    }
  }, [offset, loading, hasMore, currentCategory, currentSearch]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMoreArticles();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadMoreArticles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.push(`/article?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category && category !== "all") {
      params.set("category", category);
    } else {
      params.delete("category");
    }
    params.delete("page");
    router.push(`/article?${params.toString()}`);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher un article..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              className="pl-10"
            />
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto"
              >
                {loadingSuggestions ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                ) : suggestions.length > 0 ? (
                  <ul className="py-1">
                    {suggestions.map((suggestion, index) => (
                      <li key={suggestion.id}>
                        <Link
                          href={`/article/${suggestion.slug}`}
                          className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                            index === selectedIndex ? "bg-gray-50" : ""
                          }`}
                          onClick={() => {
                            setShowSuggestions(false);
                            setSearch(suggestion.title);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {suggestion.title}
                              </p>
                              {suggestion.category && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {suggestion.category}
                                </p>
                              )}
                            </div>
                            <Search className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Aucun résultat trouvé
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
        <Select
          value={currentCategory || "all"}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {initialTotal > 0 && (
        <p className="text-sm text-gray-600">
          {initialTotal} article{initialTotal > 1 ? "s" : ""} trouvé{initialTotal > 1 ? "s" : ""}
        </p>
      )}

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">Aucun article trouvé.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link key={article.id} href={`/article/${article.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer flex flex-col">
                  <CardHeader>
                    {article.category && (
                      <Badge variant="outline" className="mb-2 w-fit">
                        {article.category}
                      </Badge>
                    )}
                    <CardTitle className="line-clamp-2 mb-2">{article.title}</CardTitle>
                    {article.excerpt && (
                      <CardDescription className="line-clamp-3">
                        {article.excerpt}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {article.publishedAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <time dateTime={article.publishedAt.toISOString()}>
                            {formatDate(article.publishedAt)}
                          </time>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Infinite Scroll Trigger & Loading */}
          {hasMore && (
            <div ref={observerTarget} className="flex justify-center items-center py-8">
              {loading && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Chargement...</span>
                </div>
              )}
            </div>
          )}

          {!hasMore && articles.length > 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Tous les articles ont été chargés.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
