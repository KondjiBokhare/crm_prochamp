function ProductHighlights({ highlights }) {
  return (
    <section className="product-section-block">

      <h2>Key Highlights</h2>

      <div className="highlights-grid">

        {highlights.map((highlight) => (
          <div
            className="highlight-item"
            key={highlight}
          >
            <span className="highlight-dot"></span>
            <span>{highlight}</span>
          </div>
        ))}

      </div>

    </section>
  );
}

export default ProductHighlights;