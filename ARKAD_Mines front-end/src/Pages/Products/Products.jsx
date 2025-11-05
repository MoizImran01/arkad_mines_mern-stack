import React, { useState, useEffect } from 'react';
import './Products.css';
import axios from 'axios';
import { FiFilter, FiX, FiSearch, FiSliders } from 'react-icons/fi';
import { StoreContext } from '../../context/StoreContext';
import { useContext } from 'react';

const Products = () => {
  const { url } = useContext(StoreContext);
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    subcategory: 'all',
    minPrice: '',
    maxPrice: '',
    stockAvailability: 'all',
    keywords: '',
    sortBy: 'newest',
    source: 'all'
  });

  const [showFilters, setShowFilters] = useState(true);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Available filter options
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'chatral_white', label: 'Chatral White' },
    { value: 'cheeta_white', label: 'Cheeta White' },
    { value: 'pradeso', label: 'Pradeso' },
    { value: 'tiger_gray', label: 'Tiger Gray' },
    { value: 'imperial_white', label: 'Imperial White' },
    { value: 'fantasy', label: 'Fantasy' },
    { value: 'sado_pink', label: 'Sado Pink' },
    { value: 'jebrana', label: 'Jebrana' },
    { value: 'gray', label: 'Gray' },
    { value: 'black', label: 'Black' },
    { value: 'sado_gray', label: 'Sado Gray' }
  ];

  const subcategories = [
    { value: 'all', label: 'All Types' },
    { value: 'slabs', label: 'Slabs' },
    { value: 'tiles', label: 'Tiles' },
    { value: 'blocks', label: 'Blocks' },
    { value: 'crushed', label: 'Crushed Stone' },
    { value: 'top_stripe', label: 'Top Stripe' },
    { value: 'top_plain', label: 'Top Plain' },
    { value: 'bottom_stripe', label: 'Bottom Stripe' },
    { value: 'bottom_plain', label: 'Bottom Plain' }
  ];

  const availabilityOptions = [
    { value: 'all', label: 'All Availability' },
    { value: 'In Stock', label: 'In Stock' },
    { value: 'Low Stock', label: 'Low Stock' },
    { value: 'Pre-order', label: 'Pre-order' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
    { value: 'name_asc', label: 'Name: A-Z' },
    { value: 'name_desc', label: 'Name: Z-A' }
  ];

  // Source options (same as categories for now, can be customized)
  const sourceOptions = [
    { value: 'all', label: 'All Sources' },
    ...categories.filter(cat => cat.value !== 'all')
  ];

  // Apply filters
  const applyFilters = async () => {
    setLoading(true);
    setHasSearched(true);
    
    try {
      const params = new URLSearchParams();
      
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.subcategory !== 'all') params.append('subcategory', filters.subcategory);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      if (filters.stockAvailability !== 'all') params.append('stockAvailability', filters.stockAvailability);
      if (filters.keywords) params.append('keywords', filters.keywords);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.source !== 'all') params.append('source', filters.source);

      const response = await axios.get(`${url}/api/stones/filter?${params.toString()}`);
      
      if (response.data.success) {
        setProducts(response.data.stones);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching filtered products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      category: 'all',
      subcategory: 'all',
      minPrice: '',
      maxPrice: '',
      stockAvailability: 'all',
      keywords: '',
      sortBy: 'newest',
      source: 'all'
    });
    setProducts([]);
    setHasSearched(false);
  };

  // Auto-apply filters when they change (debounced for keywords)
  useEffect(() => {
    if (hasSearched) {
      const timeoutId = setTimeout(() => {
        applyFilters();
      }, filters.keywords ? 500 : 0); // Debounce keyword search

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.subcategory, filters.minPrice, filters.maxPrice, filters.stockAvailability, filters.sortBy, filters.source]);

  // Debounced keyword search
  useEffect(() => {
    if (hasSearched) {
      const timeoutId = setTimeout(() => {
        applyFilters();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.keywords]);

  // Format category name for display
  const formatCategory = (category) => {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Format subcategory name for display
  const formatSubcategory = (subcategory) => {
    return subcategory.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>Stone Blocks Catalog</h1>
        <p>Browse and filter available stone blocks</p>
      </div>

      <div className="products-content">
        {/* Filters Sidebar */}
        <div className={`filters-sidebar ${showFilters ? 'open' : 'closed'}`}>
          <div className="filters-header">
            <h2><FiFilter /> Filters</h2>
            <button 
              className="toggle-filters-btn"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? <FiX /> : <FiSliders />}
            </button>
          </div>

          {showFilters && (
            <div className="filters-content">
              {/* Keywords Search */}
              <div className="filter-group">
                <label>Keywords / SKU Search</label>
                <div className="search-input-wrapper">
                  <FiSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by name, dimensions, category..."
                    value={filters.keywords}
                    onChange={(e) => handleFilterChange('keywords', e.target.value)}
                    className="keywords-input"
                  />
                </div>
              </div>

              {/* Category Filter (Color/Pattern) */}
              <div className="filter-group">
                <label>Color / Pattern</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="filter-select"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory Filter (Product Type) */}
              <div className="filter-group">
                <label>Product Type</label>
                <select
                  value={filters.subcategory}
                  onChange={(e) => handleFilterChange('subcategory', e.target.value)}
                  className="filter-select"
                >
                  {subcategories.map(sub => (
                    <option key={sub.value} value={sub.value}>{sub.label}</option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div className="filter-group">
                <label>Price Range</label>
                <div className="price-range-inputs">
                  <input
                    type="number"
                    placeholder="Min Price"
                    value={filters.minPrice}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                    className="price-input"
                  />
                  <span className="price-separator">-</span>
                  <input
                    type="number"
                    placeholder="Max Price"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                    className="price-input"
                  />
                </div>
              </div>

              {/* Stock Availability */}
              <div className="filter-group">
                <label>Stock Availability</label>
                <select
                  value={filters.stockAvailability}
                  onChange={(e) => handleFilterChange('stockAvailability', e.target.value)}
                  className="filter-select"
                >
                  {availabilityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div className="filter-group">
                <label>Source / Mine</label>
                <select
                  value={filters.source}
                  onChange={(e) => handleFilterChange('source', e.target.value)}
                  className="filter-select"
                >
                  {sourceOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="filter-actions">
                <button 
                  className="apply-filters-btn"
                  onClick={applyFilters}
                  disabled={loading}
                >
                  {loading ? 'Applying...' : 'Apply Filters'}
                </button>
                <button 
                  className="clear-filters-btn"
                  onClick={clearFilters}
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="products-main">
          {/* Sort Bar */}
          <div className="sort-bar">
            <div className="results-count">
              {hasSearched && (
                <span>
                  {loading ? 'Loading...' : `${products.length} block${products.length !== 1 ? 's' : ''} found`}
                </span>
              )}
            </div>
            <div className="sort-selector">
              <label>Sort by:</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="sort-select"
              >
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading blocks...</p>
            </div>
          ) : !hasSearched ? (
            <div className="empty-state">
              <FiFilter className="empty-icon" />
              <h3>Apply Filters to View Blocks</h3>
              <p>Use the filters on the left to search and filter available stone blocks</p>
              <button 
                className="apply-filters-btn"
                onClick={applyFilters}
              >
                Load All Blocks
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <FiSearch className="empty-icon" />
              <h3>No blocks found</h3>
              <p>Try adjusting your filters or search criteria</p>
              <button 
                className="clear-filters-btn"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
                <div key={product._id} className="product-card">
                  <div className="product-image">
                    <img 
                      src={`${url}/images/${product.image}`} 
                      alt={product.stoneName}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                      }}
                    />
                  </div>
                  <div className="product-info">
                    <h3 className="product-name">{product.stoneName}</h3>
                    <div className="product-details">
                      <p className="product-category">
                        <span className="detail-label">Category:</span> {formatCategory(product.category)}
                      </p>
                      <p className="product-type">
                        <span className="detail-label">Type:</span> {formatSubcategory(product.subcategory)}
                      </p>
                      <p className="product-dimensions">
                        <span className="detail-label">Dimensions:</span> {product.dimensions}
                      </p>
                      <p className="product-price">
                        <span className="price-amount">Rs {product.price}</span>
                        <span className="price-unit">/{product.priceUnit}</span>
                      </p>
                      <p className={`product-stock ${product.stockAvailability?.toLowerCase().replace(' ', '-')}`}>
                        {product.stockAvailability}
                        {product.stockQuantity && (
                          <span className="stock-quantity"> ({product.stockQuantity} available)</span>
                        )}
                      </p>
                    </div>
                    {product.qrCodeImage && (
                      <div className="product-qr">
                        <img 
                          src={`${url}/images/${product.qrCodeImage}`} 
                          alt="QR Code" 
                          className="qr-thumbnail"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;

