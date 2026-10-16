import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import { X } from "lucide-react";

import ProductCard from "../../components/home/ProductCard";

import ProductFilters from "../../components/products/Productfilters";

import ProductToolbar from "../../components/products/ProductToolbar";

import { useProductCatalog } from "../../services/productCatalogService";
import { recordProductSearch } from "../../services/customerBehaviorService";

function normalizeCategoryName(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
      if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

function categoryMatches(product, selectedCategory) {
  const wanted = normalizeCategoryName(selectedCategory);
  if (!wanted) return true;
  const actuals = [product.category, product.subcategory].map(normalizeCategoryName);
  return actuals.some((actual) => Boolean(actual) && (actual === wanted || (wanted.length > 4 && (actual.includes(wanted) || wanted.includes(actual)))));
}

function productRelevanceScore(product, rawTerms) {
  const terms = String(rawTerms || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
  if (!terms.length) return 0;
  const name = String(product.name || "").toLowerCase();
  const category = normalizeCategoryName(product.category);
  const subcategory = normalizeCategoryName(product.subcategory);
  const brand = String(product.brand || "").toLowerCase();
  const specs = String(product.specs || product.shortDescription || "").toLowerCase();
  const tags = (product.tags || []).join(" ").toLowerCase();
  return terms.reduce((score, term) => {
    if (name.includes(term)) score += 4;
    if (category.includes(normalizeCategoryName(term)) || subcategory.includes(normalizeCategoryName(term))) score += 5;
    if (brand.includes(term)) score += 2;
    if (specs.includes(term) || tags.includes(term)) score += 2;
    return score;
  }, 0) + Math.min(Number(product.rating) || 0, 5) * 0.2;
}

function Products() {

  const products = useProductCatalog();

  const [searchParams, setSearchParams] =
    useSearchParams();


  const searchQuery =
    searchParams.get("search") || "";


  const categoryQuery =
    searchParams.get("category") || "";


  // =========================================
  // FILTER PANEL
  // =========================================

  const [filterOpen, setFilterOpen] =
    useState(false);


  // =========================================
  // PAGINATION
  // =========================================

  const [currentPage, setCurrentPage] =
    useState(1);


  // =========================================
  // SORT
  // =========================================

  const [sortValue, setSortValue] =
    useState("relevance");


  // =========================================
  // PRODUCT VIEW MODE (GRID / LIST)
  // =========================================

  const [viewMode, setViewMode] =
    useState("grid");


  // =========================================
  // FILTER ANIMATION
  // =========================================

  const [filterVersion, setFilterVersion] =
    useState(0);


  // =========================================
  // FILTER STATE
  // =========================================

  const [appliedFilters, setAppliedFilters] =
    useState({

      categories: [],

      brands: [],

      minPrice: null,

      maxPrice: null,

      inStockOnly: false,

      minRating: null,

    });


  const productsPerPage = 12;


  // =========================================
  // PRICE RANGE
  // =========================================

  const allProductPrices = useMemo(() => {

    return products
      .map((product) => Number(product.price))
      .filter((price) => !Number.isNaN(price));

  }, [products]);


  const minimumProductPrice =
    allProductPrices.length > 0
      ? Math.min(
          ...allProductPrices
        )
      : 0;


  const maximumProductPrice =
    allProductPrices.length > 0
      ? Math.max(
          ...allProductPrices
        )
      : 0;


  // =========================================
  // SEARCH / CATEGORY BASE PRODUCTS
  // =========================================

  const baseProducts = useMemo(() => {

    // Search matches all meaningful words across name, brand, category,
    // subcategory, specifications and tags (not only one exact phrase).
    if (searchQuery.trim()) {
      const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return products.filter((product) => {
        const haystack = [product.name, product.brand, product.category, product.subcategory, product.specs, product.shortDescription, ...(product.tags || [])].join(" ").toLowerCase();
        return tokens.every((token) => haystack.includes(token) || normalizeCategoryName(product.category).includes(normalizeCategoryName(token)));
      });
    }


    // CATEGORY
    if (categoryQuery.trim()) {

      const normalizedCategory =
        categoryQuery
          .trim()
          .toLowerCase();


      return products.filter(
        (product) => {

          return categoryMatches(product, normalizedCategory);
        }
      );
    }


    // ALL PRODUCTS

    return [...products];

  }, [
    searchQuery,
    categoryQuery,
    products,
  ]);


  // =========================================
  // APPLY FILTERS
  // =========================================

  const filteredProducts = useMemo(() => {

    let result = [
      ...baseProducts,
    ];


    // =======================================
    // CATEGORY
    // =======================================

    if (
      appliedFilters.categories
        .length > 0
    ) {

      result = result.filter(
        (product) => {

          return appliedFilters.categories.some((selectedCategory) => categoryMatches(product, selectedCategory));

        }
      );
    }


    // =======================================
    // BRAND
    // =======================================

    if (
      appliedFilters.brands
        .length > 0
    ) {

      result = result.filter(
        (product) => {

          const productBrand =
            String(
              product.brand || ""
            )
              .trim()
              .toLowerCase();


          return appliedFilters.brands.some(
            (selectedBrand) =>
              productBrand ===
              String(
                selectedBrand
              )
                .trim()
                .toLowerCase()
          );

        }
      );
    }


    // =======================================
    // MIN PRICE
    // =======================================

    if (
      appliedFilters.minPrice !==
      null
    ) {

      result = result.filter(
        (product) => {

          return (
            Number(
              product.price
            ) >=
            Number(
              appliedFilters.minPrice
            )
          );

        }
      );
    }


    // =======================================
    // MAX PRICE
    // =======================================

    if (
      appliedFilters.maxPrice !==
      null
    ) {

      result = result.filter(
        (product) => {

          return (
            Number(
              product.price
            ) <=
            Number(
              appliedFilters.maxPrice
            )
          );

        }
      );
    }


    // =======================================
    // STOCK
    // =======================================

    if (
      appliedFilters.inStockOnly
    ) {

      result = result.filter(
        (product) =>
          Number(product.stock) > 0
      );

    }


    // =======================================
    // RATING
    // =======================================

    if (
      appliedFilters.minRating !==
      null
    ) {

      result = result.filter(
        (product) =>
          Number(product.rating) >=
          Number(
            appliedFilters.minRating
          )
      );

    }


    return result;

  }, [
    baseProducts,
    appliedFilters,
  ]);


  // Track submitted search terms anonymously. The service records the latest
  // viewed product before the search, while avoiding duplicate StrictMode events.
  const lastTrackedSearchRef = useRef("");
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      lastTrackedSearchRef.current = "";
      return;
    }
    const signature = query.toLowerCase();
    if (lastTrackedSearchRef.current === signature) return;
    lastTrackedSearchRef.current = signature;
    recordProductSearch(query, {
      resultCount: filteredProducts.length,
      category: categoryQuery,
      matchedProductIds: filteredProducts.slice(0, 20).map((product) => product.id),
    });
  }, [searchQuery, categoryQuery, filteredProducts]);

  const relatedRecommendations = useMemo(() => {
    if (filteredProducts.length > 0) return [];
    const selectedTerms = [searchQuery, categoryQuery, appliedFilters.categories.join(" "), appliedFilters.brands.join(" ")].filter(Boolean).join(" ").trim();
    const preferredPool = baseProducts.length > 0 ? baseProducts : products;
    const scored = preferredPool.map((product) => ({
      product,
      score: productRelevanceScore(product, selectedTerms) + (Number(product.rating) || 0) * 0.2 + Math.min(Number(String(product.reviews || "0").replace(/[^0-9.]/g, "")) || 0, 1000) / 1000,
    })).sort((a, b) => b.score - a.score);
    const matched = scored.filter((item) => item.score > 0).slice(0, 6).map((item) => item.product);
    if (matched.length) return matched;
    // If a typo or very restrictive combination has no category match, offer
    // a small popularity-ranked fallback instead of leaving an empty page.
    return [...products].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (Number(b.reviews) || 0) - (Number(a.reviews) || 0)).slice(0, 6);
  }, [filteredProducts, baseProducts, products, searchQuery, categoryQuery, appliedFilters]);

  function clearSearchAndFilters() {
    setSearchParams({}, { replace: true });
    clearAllFilters();
    setSortValue("relevance");
    setCurrentPage(1);
  }

  // =========================================
  // SORT
  // =========================================

  const sortedProducts = useMemo(() => {

    const result = [
      ...filteredProducts,
    ];


    switch (sortValue) {

      case "price-low":

        return result.sort(
          (a, b) =>
            Number(a.price) -
            Number(b.price)
        );


      case "price-high":

        return result.sort(
          (a, b) =>
            Number(b.price) -
            Number(a.price)
        );


      case "rating":

        return result.sort(
          (a, b) =>
            Number(b.rating) -
            Number(a.rating)
        );


      case "name":

        return result.sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );


      case "newest":

        return result.sort(
          (a, b) => {

            const first =
              new Date(
                a.createdAt || 0
              ).getTime();


            const second =
              new Date(
                b.createdAt || 0
              ).getTime();


            return (
              second - first
            );

          }
        );


      default:

        return result;
    }

  }, [
    filteredProducts,
    sortValue,
  ]);


  // =========================================
  // RESET PAGE
  // =========================================

  useEffect(() => {

    setCurrentPage(1);

  }, [
    searchQuery,
    categoryQuery,
    appliedFilters,
    sortValue,
  ]);


  // =========================================
  // PAGINATION
  // =========================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedProducts.length /
        productsPerPage
      )
    );


  const safePage =
    Math.min(
      currentPage,
      totalPages
    );


  const startIndex =
    (safePage - 1) *
    productsPerPage;


  const visibleProducts =
    sortedProducts.slice(
      startIndex,
      startIndex +
        productsPerPage
    );


  // =========================================
  // FILTER CHANGE
  // =========================================

  const handleFiltersChange = (
    filters
  ) => {

    setAppliedFilters(
      filters
    );


    setCurrentPage(1);


    setFilterVersion(
      (current) =>
        current + 1
    );

    // Filter panel intentionally
    // remains open.
  };


  // =========================================
  // REMOVE CATEGORY
  // =========================================

  const removeCategoryFilter = (
    category
  ) => {

    handleFiltersChange({

      ...appliedFilters,

      categories:
        appliedFilters.categories.filter(
          (item) =>
            item !== category
        ),

    });

  };


  // =========================================
  // REMOVE BRAND
  // =========================================

  const removeBrandFilter = (
    brand
  ) => {

    handleFiltersChange({

      ...appliedFilters,

      brands:
        appliedFilters.brands.filter(
          (item) =>
            item !== brand
        ),

    });

  };


  // =========================================
  // REMOVE PRICE
  // =========================================

  const removePriceFilter = () => {

    handleFiltersChange({

      ...appliedFilters,

      minPrice: null,

      maxPrice: null,

    });

  };


  // =========================================
  // REMOVE STOCK
  // =========================================

  const removeStockFilter = () => {

    handleFiltersChange({

      ...appliedFilters,

      inStockOnly: false,

    });

  };


  // =========================================
  // REMOVE RATING
  // =========================================

  const removeRatingFilter = () => {

    handleFiltersChange({

      ...appliedFilters,

      minRating: null,

    });

  };


  // =========================================
  // CLEAR ALL ACTIVE FILTERS
  // =========================================

  const clearAllFilters = () => {

    handleFiltersChange({

      categories: [],

      brands: [],

      minPrice: null,

      maxPrice: null,

      inStockOnly: false,

      minRating: null,

    });

  };


  // =========================================
  // PRICE CHIP TEXT
  // =========================================

  const getPriceChipText = () => {

    if (
      appliedFilters.minPrice !==
        null &&
      appliedFilters.maxPrice !==
        null
    ) {

      return (
        `₹${Number(
          appliedFilters.minPrice
        ).toLocaleString("en-IN")}` +
        " – " +
        `₹${Number(
          appliedFilters.maxPrice
        ).toLocaleString("en-IN")}`
      );

    }


    if (
      appliedFilters.minPrice !==
      null
    ) {

      return (
        `₹${Number(
          appliedFilters.minPrice
        ).toLocaleString("en-IN")}` +
        "+"
      );

    }


    if (
      appliedFilters.maxPrice !==
      null
    ) {

      return (
        "Up to " +
        `₹${Number(
          appliedFilters.maxPrice
        ).toLocaleString("en-IN")}`
      );

    }


    return "";
  };


  // =========================================
  // ACTIVE FILTER CHECK
  // =========================================

  const hasActiveFilters =
    appliedFilters.categories
      .length > 0 ||
    appliedFilters.brands
      .length > 0 ||
    appliedFilters.minPrice !==
      null ||
    appliedFilters.maxPrice !==
      null ||
    appliedFilters.inStockOnly ||
    appliedFilters.minRating !==
      null;


  // =========================================
  // HEADING
  // =========================================

  let heading =
    "All Products";


  if (
    searchQuery.trim()
  ) {

    heading =
      `Search results for "${searchQuery}"`;

  } else if (
    categoryQuery.trim()
  ) {

    heading =
      categoryQuery;

  }


  // =========================================
  // PAGE CHANGE
  // =========================================

  const goToPage = (page) => {

    if (
      page < 1 ||
      page > totalPages
    ) {

      return;
    }


    setCurrentPage(
      page
    );


    window.scrollTo({

      top: 0,

      behavior: "smooth",

    });

  };


  // =========================================
  // RENDER
  // =========================================

  return (

    <div className="products-page">


      {/* =====================================
          BREADCRUMB
      ====================================== */}

      <nav
        className="products-breadcrumb"
        aria-label="Breadcrumb"
      >

        <Link
          to="/"
          className="products-breadcrumb-link"
        >
          Home
        </Link>


        <span>/</span>


        {searchQuery ? (

          <>

            <Link
              to="/products"
              className="products-breadcrumb-link"
            >
              Search
            </Link>

            <span>/</span>

            <strong>
              {searchQuery}
            </strong>

          </>

        ) : categoryQuery ? (

          <>

            <Link
              to="/products"
              className="products-breadcrumb-link"
            >
              Category
            </Link>

            <span>/</span>

            <Link
              to={`/products?category=${encodeURIComponent(
                categoryQuery
              )}`}
              className="products-breadcrumb-link"
            >
              {categoryQuery}
            </Link>

          </>

        ) : (

          <strong>
            Products
          </strong>

        )}

      </nav>


      {/* =====================================
          HEADING
      ====================================== */}

      <div className="products-heading">

        <div>

          <h1>
            {heading}
          </h1>

          <p>
            {sortedProducts.length}{" "}

            {sortedProducts.length ===
            1
              ? "product"
              : "products"}{" "}

            available
          </p>

        </div>

      </div>


      {/* =====================================
          PRODUCT CONTENT
      ====================================== */}

      <div className="products-layout">

        <main className="products-content">


          {/* =================================
              TOOLBAR + FILTER DROPDOWN
          ================================== */}

          <div className="products-toolbar-area">


            {/* TOOLBAR */}

            <ProductToolbar
              resultCount={
                sortedProducts.length
              }

              onFilterClick={() =>
                setFilterOpen(
                  (current) =>
                    !current
                )
              }

              sortValue={
                sortValue
              }

              onSortChange={
                setSortValue
              }

              viewMode={viewMode}

              onViewModeChange={setViewMode}
            />


            {/* =================================
                ACTIVE FILTER CHIPS
            ================================== */}

            {hasActiveFilters && (

              <div className="active-filter-bar">

                <span className="active-filter-label">
                  Filters:
                </span>


                {/* CATEGORY CHIPS */}

                {appliedFilters.categories.map(
                  (category) => (

                    <button
                      key={`category-${category}`}
                      type="button"
                      className="active-filter-chip"
                      onClick={() =>
                        removeCategoryFilter(
                          category
                        )
                      }
                    >

                      <span>
                        {category}
                      </span>

                      <X size={13} />

                    </button>

                  )
                )}


                {/* BRAND CHIPS */}

                {appliedFilters.brands.map(
                  (brand) => (

                    <button
                      key={`brand-${brand}`}
                      type="button"
                      className="active-filter-chip"
                      onClick={() =>
                        removeBrandFilter(
                          brand
                        )
                      }
                    >

                      <span>
                        {brand}
                      </span>

                      <X size={13} />

                    </button>

                  )
                )}


                {/* PRICE CHIP */}

                {(
                  appliedFilters.minPrice !==
                    null ||
                  appliedFilters.maxPrice !==
                    null
                ) && (

                  <button
                    type="button"
                    className="active-filter-chip"
                    onClick={
                      removePriceFilter
                    }
                  >

                    <span>
                      {getPriceChipText()}
                    </span>

                    <X size={13} />

                  </button>

                )}


                {/* STOCK CHIP */}

                {appliedFilters.inStockOnly && (

                  <button
                    type="button"
                    className="active-filter-chip"
                    onClick={
                      removeStockFilter
                    }
                  >

                    <span>
                      In Stock
                    </span>

                    <X size={13} />

                  </button>

                )}


                {/* RATING CHIP */}

                {appliedFilters.minRating !==
                  null && (

                  <button
                    type="button"
                    className="active-filter-chip"
                    onClick={
                      removeRatingFilter
                    }
                  >

                    <span>
                      {appliedFilters.minRating}★
                      {" "} & Above
                    </span>

                    <X size={13} />

                  </button>

                )}


                {/* CLEAR ALL */}

                <button
                  type="button"
                  className="clear-active-filters"
                  onClick={
                    clearAllFilters
                  }
                >
                  Clear all
                </button>

              </div>

            )}


            {/* =================================
                FILTER DROPDOWN
            ================================== */}

           <div
  className={`filter-dropdown-wrapper ${
    filterOpen ? "open" : ""
  }`}
  onMouseDown={(event) => {
    if (event.target === event.currentTarget) {
      setFilterOpen(false);
    }
  }}
>

              <ProductFilters

                mobileOpen={
                  filterOpen
                }

                onClose={() =>
                  setFilterOpen(
                    false
                  )
                }

                filters={
                  appliedFilters
                }

                onFiltersChange={
                  handleFiltersChange
                }

              />

            </div>

          </div>


          {/* =====================================
              PRODUCTS
          ====================================== */}

          {visibleProducts.length === 0 ? (
            <div className="product-empty-results-wrap">
              <div className="empty-products product-empty-state">
                <h2>No exact matches found</h2>
                <p>We couldn't find a product matching every selected filter. Here are some alternatives you may like.</p>
                <button type="button" className="clear-active-filters product-empty-clear-button" onClick={clearSearchAndFilters}>Clear search and filters</button>
              </div>
              {relatedRecommendations.length > 0 && (
                <section className="product-section product-empty-recommendations" aria-labelledby="empty-related-heading">
                  <div className="section-heading">
                    <div>
                      <h2 id="empty-related-heading">Related products you may like</h2>
                      <p className="section-subtitle">Suggestions are based on product category, specifications, search words and popularity.</p>
                    </div>
                    <Link to="/products" className="view-all-button" onClick={() => { setAppliedFilters({ categories: [], brands: [], minPrice: null, maxPrice: null, inStockOnly: false, minRating: null }); setSortValue("relevance"); }}>View all products →</Link>
                  </div>
                  <div className="product-grid related-product-grid">
                    {relatedRecommendations.map((product) => <ProductCard key={product.id} product={product} />)}
                  </div>
                </section>
              )}
            </div>
          ) : (

            <div
              key={filterVersion}
              className={`search-product-grid filter-result-animation ${
                viewMode === "list" ? "list-view" : "grid-view"
              }`}
            >

              {visibleProducts.map(
                (product) => (

                  <ProductCard
                    key={product.id}
                    product={product}
                  />

                )
              )}

            </div>

          )}


          {/* =====================================
              PAGINATION
          ====================================== */}

          {sortedProducts.length >
            0 && (

            <div className="pagination">

              <button
                type="button"
                onClick={() =>
                  goToPage(
                    safePage - 1
                  )
                }
                disabled={
                  safePage === 1
                }
              >
                ←
              </button>


              {Array.from(
                {
                  length:
                    totalPages,
                }
              ).map(
                (_, index) => {

                  const page =
                    index + 1;


                  return (

                    <button
                      key={page}
                      type="button"
                      className={
                        page ===
                        safePage
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        goToPage(
                          page
                        )
                      }
                    >
                      {page}
                    </button>

                  );

                }
              )}


              <button
                type="button"
                onClick={() =>
                  goToPage(
                    safePage + 1
                  )
                }
                disabled={
                  safePage ===
                  totalPages
                }
              >
                →
              </button>

            </div>

          )}

          <p className="storefront-behavior-notice" role="note">
            Demo analytics notice: anonymous product views and submitted product searches may be stored in this browser to power CRM behaviour insights. This prototype tracker does not intentionally collect contact or payment details.
          </p>

        </main>

      </div>

    </div>
  );
}


export default Products;