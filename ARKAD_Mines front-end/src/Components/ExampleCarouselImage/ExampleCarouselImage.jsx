import React from 'react';
import PropTypes from 'prop-types';

const ExampleCarouselImage = ({ src, text }) => {
  return (
    <div>
      <img
        className="d-block w-100"
        src={src}
        alt={text}
      />
    </div>
  );
}

ExampleCarouselImage.propTypes = {
  src: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
};

export default ExampleCarouselImage;
