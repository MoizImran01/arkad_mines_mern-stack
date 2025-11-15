

import React from 'react';

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

export default ExampleCarouselImage;
