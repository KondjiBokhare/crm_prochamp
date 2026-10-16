
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
  viewMode = "grid",
  onViewModeChange = () => {},
}) {
  return (
    <div className="product-toolbar">
      <div className="toolbar-left">
        <span className="result-count">
          {resultCount} products
        </span>

        <button
          type="button"
          className={`toolbar-filter-button ${
            typeof onFilterClick === "function"
              ? ""
              : "disabled"
          }`}
          onClick={onFilterClick}
          disabled={typeof onFilterClick !== "function"}
        >
          <SlidersHorizontal size={15} />
          <span>Filter</span>
          <span className="filter-chevron">▾</span>
        </button>
      </div>

      <div className="toolbar-right">
        <button
          type="button"
          className={`view-toggle ${
            viewMode === "grid" ? "active" : ""
          }`}
          aria-label="Grid view"
          aria-pressed={viewMode === "grid"}
          onClick={() => onViewModeChange("grid")}
        >
          <Grid2X2 size={16} />
        </button>

        <button
          type="button"
          className={`view-toggle ${
            viewMode === "list" ? "active" : ""
          }`}
          aria-label="List view"
          aria-pressed={viewMode === "list"}
          onClick={() => onViewModeChange("list")}
        >
          <List size={16} />
        </button>

        <select
          className="sort-button"
          aria-label="Sort products"
          value={sortValue}
          onChange={(event) =>
            onSortChange(event.target.value)
          }
        >
          <option value="relevance">Relevance</option>
          <option value="price-low">
            Price: Low to High
          </option>
          <option value="price-high">
            Price: High to Low
          </option>
          <option value="rating">
            Customer Rating
          </option>
          <option value="name">Name: A to Z</option>
          <option value="newest">Newest</option>
        </select>
      </div>
    </div>
  );
}

export default ProductToolbar;
