import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import ProductDetails from './frontend/src/pages/ProductDetails.jsx';

// Polyfills and mocks
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

const Test = () => (
  <StaticRouter location="/product/70">
    <ProductDetails />
  </StaticRouter>
);

try {
  console.log(renderToString(<Test />));
} catch (e) {
  console.error("Crash!", e);
}
