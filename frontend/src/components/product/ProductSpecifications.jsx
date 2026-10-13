function ProductSpecifications({ specifications }) {
  return (
    <section className="product-section-block">

      <h2>Specifications</h2>

      <div className="specifications-table">

        {specifications.map(([label, value]) => (
          <div
            className="specification-row"
            key={label}
          >
            <span className="specification-label">
              {label}
            </span>

            <span className="specification-value">
              {value}
            </span>
          </div>
        ))}

      </div>

    </section>
  );
}

export default ProductSpecifications;