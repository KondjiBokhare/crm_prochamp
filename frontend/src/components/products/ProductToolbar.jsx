import {
  SlidersHorizontal,
  Grid2X2,
  List,
} from "lucide-react";

function ProductToolbar({
  resultCount,
  onFilterClick,
  sortValue,
  onSortChange,
}) {
  return (
    <div className="product-toolbar">

      {/* Left */}
      <div className="toolbar-left">

        <span className="result-count">
          {resultCount} products
        </span>

        {/* Filter */}
        <button
          type="button"
          className={`toolbar-filter-button ${
            typeof onFilterClick ===
              "function"
              ? ""
              : "disabled"
          }`}
          onClick={onFilterClick}
        >
          <SlidersHorizontal size={15} />

          <span>Filter</span>

          <span className="filter-chevron">
            ▾
          </span>
        </button>

      </div>

      {/* Right */}
      <div className="toolbar-right">

        {/* Grid */}
        <button
          type="button"
          className="view-toggle active"
          aria-label="Grid view"
        >
          <Grid2X2 size={16} />
        </button>

        {/* List */}
        <button
          type="button"
          className="view-toggle"
          aria-label="List view"
        >
          <List size={16} />
        </button>

        {/* Sort */}
        <select
          className="sort-button"
          value={sortValue}
          onChange={(e) =>
            onSortChange(
              e.target.value
            )
          }
        >
          <option value="relevance">
            Relevance
          </option>

          <option value="price-low">
            Price: Low to High
          </option>

          <option value="price-high">
            Price: High to Low
          </option>

          <option value="rating">
            Customer Rating
          </option>

          <option value="name">
            Name: A to Z
          </option>

          <option value="newest">
            Newest
          </option>
        </select>

      </div>
    </div>
  );
}

export default ProductToolbar;