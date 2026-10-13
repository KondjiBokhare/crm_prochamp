import {
  Check,
  X,
} from "lucide-react";

import { useProductCatalog } from "../../services/productCatalogService";
import { useCategories } from "../../services/siteSettingsService";


const EMPTY_FILTERS = {

  categories: [],

  brands: [],

  minPrice: null,

  maxPrice: null,

  inStockOnly: false,

  minRating: null,

};


function ProductFilters({

  mobileOpen,

  onClose,

  filters,

  onFiltersChange,

}) {

  const products = useProductCatalog();
  const categoryRecords = useCategories();

  // Category options come from Category Management, not just categories that
  // currently have products. A category with zero products can still be chosen;
  // the listing page then shows related product suggestions and a clear-filter action.
  const categories = categoryRecords.map((category) => category.name);


  // =========================================
  // AVAILABLE BRANDS
  // =========================================

  const brands = [
    ...new Set(
      products
        .map(
          (product) =>
            product.brand
        )
        .filter(Boolean)
    ),
  ];


  // =========================================
  // PRODUCT PRICES
  // =========================================

  const prices = products

    .map((product) =>
      Number(product.price)
    )

    .filter(
      (price) =>
        !Number.isNaN(price)
    );


  const minimumProductPrice =
    prices.length > 0
      ? Math.min(...prices)
      : 0;


  const maximumProductPrice =
    prices.length > 0
      ? Math.max(...prices)
      : 0;


  // =========================================
  // CURRENT SLIDER VALUES
  // =========================================

  const currentMinPrice =
    filters.minPrice ??
    minimumProductPrice;


  const currentMaxPrice =
    filters.maxPrice ??
    maximumProductPrice;


  // =========================================
  // CATEGORY CHANGE
  // =========================================

  const handleCategoryChange = (
    category
  ) => {

    const selected =
      filters.categories.includes(
        category
      );


    const nextCategories =
      selected

        ? filters.categories.filter(
            (item) =>
              item !== category
          )

        : [
            ...filters.categories,
            category,
          ];


    onFiltersChange({

      ...filters,

      categories:
        nextCategories,

    });

  };


  // =========================================
  // BRAND CHANGE
  // =========================================

  const handleBrandChange = (
    brand
  ) => {

    const selected =
      filters.brands.includes(
        brand
      );


    const nextBrands =
      selected

        ? filters.brands.filter(
            (item) =>
              item !== brand
          )

        : [
            ...filters.brands,
            brand,
          ];


    onFiltersChange({

      ...filters,

      brands:
        nextBrands,

    });

  };


  // =========================================
  // MIN PRICE
  // =========================================

  const handleMinPriceChange = (
    value
  ) => {

    const numericValue =
      Number(value);


    const safeValue =
      Math.min(
        numericValue,
        currentMaxPrice
      );


    onFiltersChange({

      ...filters,

      minPrice:
        safeValue <=
        minimumProductPrice
          ? null
          : safeValue,

    });

  };


  // =========================================
  // MAX PRICE
  // =========================================

  const handleMaxPriceChange = (
    value
  ) => {

    const numericValue =
      Number(value);


    const safeValue =
      Math.max(
        numericValue,
        currentMinPrice
      );


    onFiltersChange({

      ...filters,

      maxPrice:
        safeValue >=
        maximumProductPrice
          ? null
          : safeValue,

    });

  };


  // =========================================
  // STOCK
  // =========================================

  const handleStockChange =
    () => {

      onFiltersChange({

        ...filters,

        inStockOnly:
          !filters.inStockOnly,

      });

    };


  // =========================================
  // RATING
  // =========================================

  const handleRatingChange = (
    rating
  ) => {

    onFiltersChange({

      ...filters,

      minRating:
        filters.minRating ===
        rating
          ? null
          : rating,

    });

  };


  // =========================================
  // CLEAR ALL
  // =========================================

  const handleClearAll = () => {

    onFiltersChange({
      ...EMPTY_FILTERS,
    });

  };


  // =========================================
  // CATEGORY COUNT
  // =========================================

  const getCategoryCount = (
    category
  ) => {

    return products.filter(
      (product) =>
        String(
          product.category || ""
        )
          .trim()
          .toLowerCase() ===
        String(category)
          .trim()
          .toLowerCase()
    ).length;

  };


  // =========================================
  // BRAND COUNT
  // =========================================

  const getBrandCount = (
    brand
  ) => {

    return products.filter(
      (product) =>
        String(
          product.brand || ""
        )
          .trim()
          .toLowerCase() ===
        String(brand)
          .trim()
          .toLowerCase()
    ).length;

  };


  // =========================================
  // FORMAT PRICE
  // =========================================

  const formatPrice = (
    value
  ) => {

    return `₹${Number(
      value
    ).toLocaleString(
      "en-IN"
    )}`;

  };


  // =========================================
  // SLIDER POSITION
  // =========================================

  const priceRange =
    maximumProductPrice -
    minimumProductPrice;


  const minPosition =
    priceRange === 0
      ? 0
      : (
          (
            currentMinPrice -
            minimumProductPrice
          ) /
          priceRange
        ) * 100;


  const maxPosition =
    priceRange === 0
      ? 100
      : (
          (
            currentMaxPrice -
            minimumProductPrice
          ) /
          priceRange
        ) * 100;


  // =========================================
  // UI
  // =========================================

  return (

    <aside
      className={`product-filters ${
        mobileOpen
          ? "product-filters-mobile-open"
          : ""
      }`}
    >


      {/* =====================================
          HEADER
      ====================================== */}

      <div className="filter-header">

        <div>

          <h3>
            Filters
          </h3>

        </div>


        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >

          <button
            type="button"
            className="text-action-button"
            onClick={
              handleClearAll
            }
          >
            Clear All
          </button>


          <button
            type="button"
            className="mobile-close-filter"
            onClick={onClose}
            aria-label="Close filters"
          >

            <X size={18} />

          </button>

        </div>

      </div>


      {/* =====================================
          CATEGORIES
      ====================================== */}

      <div className="filter-group">

        <h4>
          Categories
        </h4>


        {categories.map(
          (category) => {

            const checked =
              filters.categories.includes(
                category
              );


            return (

              <label
                key={category}
                className="custom-filter-option"
              >

                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    handleCategoryChange(
                      category
                    )
                  }
                />


                <span className="custom-checkbox">

                  {checked && (
                    <Check size={11} />
                  )}

                </span>


                <span>
                  {category}
                </span>


                <span
                  style={{
                    marginLeft:
                      "auto",
                    color:
                      "#94a3b8",
                    fontSize:
                      "10px",
                  }}
                >
                  (
                  {
                    getCategoryCount(
                      category
                    )
                  }
                  )
                </span>

              </label>

            );

          }
        )}

      </div>


      {/* =====================================
          BRAND
      ====================================== */}

      <div className="filter-group">

        <h4>
          Brand
        </h4>


        <div className="brand-filter-grid">

          {brands.map(
            (brand) => {

              const selected =
                filters.brands.includes(
                  brand
                );


              return (

                <button
                  key={brand}
                  type="button"
                  className={`brand-filter-chip ${
                    selected
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleBrandChange(
                      brand
                    )
                  }
                >

                  {brand}

                  <span>
                    (
                    {
                      getBrandCount(
                        brand
                      )
                    }
                    )
                  </span>

                </button>

              );

            }
          )}

        </div>

      </div>


      {/* =====================================
          PRICE RANGE
      ====================================== */}

      <div className="filter-group">

        <div className="filter-title-row">

          <h4>
            Price Range
          </h4>


          <span className="price-range-value">

            {formatPrice(
              currentMinPrice
            )}

            {" – "}

            {formatPrice(
              currentMaxPrice
            )}

          </span>

        </div>


        <div className="price-slider">


          <div className="price-slider-track" />


          <div
            className="price-slider-fill"
            style={{
              left:
                `${minPosition}%`,
              right:
                `${100 - maxPosition}%`,
            }}
          />


          {/* MIN */}

          <input
            type="range"
            className="price-range-input price-range-min"
            min={
              minimumProductPrice
            }
            max={
              maximumProductPrice
            }
            step="1"
            value={
              currentMinPrice
            }
            onChange={(event) =>
              handleMinPriceChange(
                event.target.value
              )
            }
            aria-label="Minimum price"
          />


          {/* MAX */}

          <input
            type="range"
            className="price-range-input price-range-max"
            min={
              minimumProductPrice
            }
            max={
              maximumProductPrice
            }
            step="1"
            value={
              currentMaxPrice
            }
            onChange={(event) =>
              handleMaxPriceChange(
                event.target.value
              )
            }
            aria-label="Maximum price"
          />

        </div>


        <div className="price-slider-labels">

          <span>
            {formatPrice(
              minimumProductPrice
            )}
          </span>


          <span>
            {formatPrice(
              maximumProductPrice
            )}
          </span>

        </div>

      </div>


      {/* =====================================
          AVAILABILITY
      ====================================== */}

      <div className="filter-group">

        <h4>
          Availability
        </h4>


        <label className="custom-filter-option">

          <input
            type="checkbox"
            checked={
              filters.inStockOnly
            }
            onChange={
              handleStockChange
            }
          />


          <span className="custom-checkbox">

            {filters.inStockOnly && (
              <Check size={11} />
            )}

          </span>


          <span>
            In Stock
          </span>

        </label>

      </div>


      {/* =====================================
          CUSTOMER RATING
      ====================================== */}

      <div className="filter-group">

        <h4>
          Customer Rating
        </h4>


        {[4, 3, 2].map(
          (rating) => {

            const selected =
              filters.minRating ===
              rating;


            return (

              <label
                key={rating}
                className="custom-filter-option"
              >

                <input
                  type="checkbox"
                  checked={
                    selected
                  }
                  onChange={() =>
                    handleRatingChange(
                      rating
                    )
                  }
                />


                <span className="custom-checkbox">

                  {selected && (
                    <Check size={11} />
                  )}

                </span>


                <span>

                  {"★".repeat(
                    rating
                  )}

                  {"☆".repeat(
                    5 - rating
                  )}

                  {" "}
                  & above

                </span>

              </label>

            );

          }
        )}

      </div>

    </aside>

  );
}


export default ProductFilters;